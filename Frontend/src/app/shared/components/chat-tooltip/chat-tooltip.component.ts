import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

const CHAT_PROMPTS = [
  "👋 Hi! I'm FolioAI, Ask here...",
  'How many years of experience does Rohit have?',
  'What tech stack does Rohit use?',
  'Is Rohit open to new opportunities?',
  'What projects has Rohit worked on?',
  'Where is Rohit based?',
];

type Phase = 'typing' | 'paused' | 'deleting';

@Component({
  selector: 'app-chat-tooltip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-tooltip.component.html',
  styleUrls: ['./chat-tooltip.component.scss'],
})
export class ChatTooltipComponent implements OnChanges, OnDestroy {
  /** Hide tooltip when the chat tab is active */
  @Input() visible = true;

  displayed = signal('');
  phase     = signal<Phase>('typing');
  promptIdx = signal(0);

  /** First prompt gets the gradient intro style */
  isIntro = computed(() => this.promptIdx() === 0);

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']) {
      if (this.visible) {
        this.reset();
        this.tick();
      } else {
        this.clearTimer();
      }
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private reset(): void {
    this.displayed.set('');
    this.phase.set('typing');
    this.promptIdx.set(0);
  }

  private clearTimer(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  private tick(): void {
    if (!this.visible) return;

    const full  = CHAT_PROMPTS[this.promptIdx()];
    const cur   = this.displayed();
    const phase = this.phase();

    if (phase === 'typing') {
      if (cur.length < full.length) {
        const delay = this.promptIdx() === 0 ? 55 : 38;
        this.timer = setTimeout(() => {
          this.displayed.set(full.slice(0, cur.length + 1));
          this.tick();
        }, delay);
      } else {
        this.phase.set('paused');
        this.timer = setTimeout(() => {
          this.phase.set('deleting');
          this.tick();
        }, 2200);
      }
      return;
    }

    if (phase === 'deleting') {
      if (cur.length > 0) {
        this.timer = setTimeout(() => {
          this.displayed.set(cur.slice(0, -1));
          this.tick();
        }, 22);
      } else {
        this.promptIdx.update(i => (i + 1) % CHAT_PROMPTS.length);
        this.phase.set('typing');
        this.tick();
      }
    }
  }
}
