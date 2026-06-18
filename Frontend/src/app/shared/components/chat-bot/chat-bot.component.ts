import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonApp } from 'src/app/core/services/common';
import { MarkdownComponent } from 'ngx-markdown';

// ── Types ─────────────────────────────────────────────────────

export type ChatPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  loading?: boolean;
  error?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;         // auto-generated from first user message
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelVersion {
  name: string;
  model: string;
  description: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Component ─────────────────────────────────────────────────

@Component({
  selector: 'app-chat-bot',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, MarkdownComponent],
  templateUrl: './chat-bot.component.html',
  styleUrls: ['./chat-bot.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatBotComponent extends CommonApp implements OnInit, OnDestroy {

  // ── Inputs ───────────────────────────────────────────────────
  @Input() position: ChatPosition = 'bottom-right';
  @Input() title = 'AiNg Assistant';
  @Input() placeholder = 'Ask about Rohit…';

  // ── Template refs ────────────────────────────────────────────
  @ViewChild('messagesEnd') private messagesEnd!: ElementRef<HTMLDivElement>;
  @ViewChild('inputRef') private inputRef!: ElementRef<HTMLInputElement>;

  // ── UI state (signals) ───────────────────────────────────────
  isOpen = signal(false);
  showWelcome = signal(true);
  showHistory = signal(false);
  isSending = signal(false);
  newMessage = signal('');
  chatDisabled = signal(false);

  // ── Data (signals) ───────────────────────────────────────────
  sessions = signal<ChatSession[]>([]);
  activeSessionId = signal<string | null>(null);

  // ── Model versions ───────────────────────────────────────────
  readonly modelVersions: ModelVersion[] = [
    { name: 'AiNg v1.5 Beta', model: 'v1.5b', description: 'Fast, experimental' },
    { name: 'AiNg v1.5 Stable', model: 'v1.5s', description: 'Balanced' },
    { name: 'AiNg v2.5 Stable', model: 'v2.5s', description: 'Most capable' },
  ];
  selectedModel = signal(this.modelVersions[0].model);

  // ── Derived ──────────────────────────────────────────────────
  activeSession = computed(() =>
    this.sessions().find(s => s.id === this.activeSessionId()) ?? null
  );

  activeMessages = computed(() =>
    this.activeSession()?.messages ?? []
  );

  /** Side that the FAB + window anchor to. */
  isLeft = computed(() => this.position.includes('left'));
  isTop  = computed(() => this.position.includes('top'));

  // ── Cleanup ──────────────────────────────────────────────────
  private _scrollEffect = effect(() => {
    // Re-run whenever messages change so new messages scroll into view.
    this.activeMessages();
    this._scrollToBottom();
  });

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this._loadHistory();
  }

  ngOnDestroy(): void {
    this._scrollEffect.destroy();
  }

  // ── Chat window ───────────────────────────────────────────────

  toggleChat(): void {
    const opening = !this.isOpen();
    this.isOpen.set(opening);
    this.showWelcome.set(!opening);

    if (opening) {
      // Open into the most-recent session or create a fresh one
      if (!this.activeSessionId() || !this.activeSession()) {
        this._startNewSession();
      }
      // Delay gives Angular one cycle to render the window + messages
      // before we attempt to scroll — otherwise messagesEnd doesn't exist yet.
      setTimeout(() => {
        this._scrollToBottom();
        this.inputRef?.nativeElement.focus();
      }, 150);
    }
  }

  toggleHistory(): void {
    this.showHistory.update(v => !v);
  }

  // ── Session management ────────────────────────────────────────

  startNewChat(): void {

    this.activeSessionId.set(null);

    this.sessions.update(s => [
      {
        id: 'temp',
        title: 'New chat',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      ...s
    ]);

  }

  selectSession(id: string): void {

    this.aiChatService.getSession(id).subscribe({
      next: (session) => {
        const mappedMessages = (session.messages || []).map(m => ({
          id: uid(),
          text: m.text,
          sender: m.sender,
          timestamp: new Date(m.time)
        }));

        this.sessions.update(list =>
          list.map(s =>
            s.id === id
              ? { ...s, messages: mappedMessages }
              : s
          )
        );
        this.showHistory.update(v => !v);
        this.activeSessionId.set(id);
        setTimeout(() => this._scrollToBottom(), 80);
      }

    });
  }

  clearAllHistory(): void {

    this.aiChatService.deleteAllSessions().subscribe(() => {

      this.sessions.set([]);
      this.activeSessionId.set(null);

    });

  }

  // ── Messaging ─────────────────────────────────────────────────

  async sendMessage(): Promise<void> {
    const text = this.newMessage().trim();
    if (!text || this.isSending()) return;

    const sessionId = this.activeSessionId();

    const userMsg: ChatMessage = {
      id: uid(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    this._appendMessage(userMsg);

    this.newMessage.set('');
    this.isSending.set(true);

    const loadingId = uid();

    this._appendMessage({
      id: loadingId,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      loading: true,
    });

    this.appService.aiChat(text, sessionId).subscribe({
      next: (res) => {
        if (res.limitReached) {
          this.isSending.set(false);
          this._appendMessage({
            id: uid(),
            text:
              "Chat limit reached. For more info go to contact section and send message to Rohit.",
            sender: 'bot',
            timestamp: new Date(),
            error: true,
            loading: false
          });
          this.chatDisabled.set(true);
          return;
        }
        const reply = res.response;
        // replace loading
        this._replaceMessage(loadingId, {
          id: uid(),
          text: reply,
          sender: 'bot',
          timestamp: new Date(),
          loading: false
        });
        // IMPORTANT → session created here
        if (!sessionId) {
          this.activeSessionId.set(res.sessionId);
          // reload sessions list
          this._loadHistory();
        }
        this.isSending.set(false);
      },

      error: () => {
        this._replaceMessage(loadingId, {
          id: uid(),
          text: 'Error',
          sender: 'bot',
          timestamp: new Date(),
          error: true
        });
        this.isSending.set(false);
      }

    });

  }

  deleteSession(id: string, event: Event): void {
    event.stopPropagation();

    this.aiChatService.deleteSession(id).subscribe({

      next: () => {

        const updated = this.sessions().filter(s => s.id !== id);
        this.sessions.set(updated);

        if (this.activeSessionId() === id) {

          const next = updated[0] ?? null;

          if (next) {
            this.activeSessionId.set(next.id);
          } else {
            this.startNewChat();
          }

        }

      },

      error: () => {
        console.error("Delete failed");
      }

    });
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onModelChange(model: string): void {
    this.selectedModel.set(model);
  }

  trackById(_: number, item: ChatMessage | ChatSession): string {
    return item.id;
  }

  // ── Private helpers ───────────────────────────────────────────

  private _startNewSession(): void {
    // this.aiChatService.createSession("").subscribe({

    //   next: (session) => {

    //     const newSession = {
    //       id: session.id,
    //       title: session.title ?? 'New chat',
    //       messages: [],
    //       createdAt: new Date(),
    //       updatedAt: new Date(),
    //     };

    //     this.sessions.update(s => [newSession, ...s]);

    //     this.activeSessionId.set(newSession.id);

    //   },

    //   error: () => {
    //     console.error("Failed to create session");
    //   }

    // });
  }

  private _appendMessage(msg: ChatMessage): void {
    this.sessions.update(sessions =>
      sessions.map(s => {
        if (s.id !== this.activeSessionId()) { return s; }
        const messages = [...s.messages, msg];
        // Auto-title from first user message
        const title = s.title === 'New conversation'
          ? (msg.sender === 'user' ? msg.text.slice(0, 36) + (msg.text.length > 36 ? '…' : '') : s.title)
          : s.title;
        return { ...s, messages, title, updatedAt: new Date() };
      })
    );
    this._saveHistory(this.sessions());
    this._scrollToBottom();
  }

  private _replaceMessage(id: string, replacement: ChatMessage): void {
    this.sessions.update(sessions =>
      sessions.map(s => {
        if (s.id !== this.activeSessionId()) { return s; }
        return {
          ...s,
          messages: s.messages.map(m => m.id === id ? replacement : m),
          updatedAt: new Date(),
        };
      })
    );
    this._saveHistory(this.sessions());
  }

  private _scrollToBottom(): void {
    setTimeout(() => {
      try {
        this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      } catch (_) { }
    }, 80);
  }

  // ── Persistence (localStorage) ────────────────────────────────

  private readonly _STORAGE_KEY = 'aing_chat_history';

  private _saveHistory(sessions: ChatSession[]): void {
    try {
      // Keep only the 20 most recent sessions to avoid storage bloat
      const trimmed = sessions.slice(0, 20);
      localStorage.setItem(this._STORAGE_KEY, JSON.stringify(trimmed));
    } catch (_) { }
  }

  private _loadHistory(): void {

    this.aiChatService.getSessions().subscribe({

      next: (sessions) => {

        const mapped = sessions.map(s => ({

          id: s.id,
          title: s.title ?? 'Conversation',

          messages: (s.messages || []).map(m => ({
            id: uid(),
            text: m.text,
            sender: m.sender,
            timestamp: new Date(m.time)
          })),

          createdAt: new Date(s.created_at),
          updatedAt: new Date(s.updated_at)

        }));

        this.sessions.set(mapped);

        if (mapped.length > 0) {
          this.activeSessionId.set(mapped[0].id);
        }

      }

    });
  }
}