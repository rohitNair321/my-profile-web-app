import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ChatBotComponent } from './chat-bot.component';
import { AppService } from 'src/app/core/services/app.service';
import { AuthService } from 'src/app/auth/services/auth.service';
import { ChatApiService } from 'src/app/core/services/chat-api.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { LoadingService } from 'src/app/core/services/loading.service';
import { LocalStorageService } from 'src/app/shared/services/local-storage.service';

describe('ChatBotComponent', () => {
  let component: ChatBotComponent;
  let fixture: ComponentFixture<ChatBotComponent>;

  const mockAppService = {
    role:    signal<string | null>('GUEST'),
    profile: signal<any>(null),
    _profile: { set: jasmine.createSpy('set') },
    setRole: jasmine.createSpy('setRole'),
    aiChat:  jasmine.createSpy('aiChat').and.returnValue(
      of({ response: 'Hello!', sessionId: 'sess-1', limitReached: false })
    ),
  };

  const mockChatApiService = {
    getSessions:       jasmine.createSpy().and.returnValue(of([])),
    getSession:        jasmine.createSpy().and.returnValue(of({ messages: [] })),
    deleteSession:     jasmine.createSpy().and.returnValue(of({})),
    deleteAllSessions: jasmine.createSpy().and.returnValue(of({})),
  };

  const mockAuthService = {
    token: signal<string | null>(null),
    role:  signal<string | null>('GUEST'),
  };

  const mockAlertService  = { showAlert: jasmine.createSpy('showAlert') };
  const mockLoadingService = { show: jasmine.createSpy('show'), hide: jasmine.createSpy('hide') };
  const mockLocalStorage   = {
    getItem:    jasmine.createSpy().and.returnValue(null),
    setItem:    jasmine.createSpy(),
    removeItem: jasmine.createSpy(),
    clear:      jasmine.createSpy(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatBotComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AppService,         useValue: mockAppService },
        { provide: AuthService,        useValue: mockAuthService },
        { provide: ChatApiService,     useValue: mockChatApiService },
        { provide: AlertService,       useValue: mockAlertService },
        { provide: LoadingService,     useValue: mockLoadingService },
        { provide: LocalStorageService, useValue: mockLocalStorage },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(ChatBotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('starts with chat window closed', () => {
    expect(component.isOpen()).toBeFalse();
  });

  it('opens chat window on toggleChat()', () => {
    component.toggleChat();
    expect(component.isOpen()).toBeTrue();
  });

  it('closes chat window on second toggleChat()', () => {
    component.toggleChat();
    component.toggleChat();
    expect(component.isOpen()).toBeFalse();
  });

  it('shows empty messages when no session is active', () => {
    expect(component.activeMessages()).toEqual([]);
  });

  it('does not send empty message', fakeAsync(() => {
    component.newMessage.set('');
    component.sendMessage();
    tick();
    expect(mockAppService.aiChat).not.toHaveBeenCalled();
  }));

  it('does not send while already sending', fakeAsync(() => {
    component.isSending.set(true);
    component.newMessage.set('hello');
    component.sendMessage();
    tick();
    expect(mockAppService.aiChat).not.toHaveBeenCalled();
  }));

  it('appends user message and bot placeholder on send', fakeAsync(() => {
    component.newMessage.set('What is Angular?');
    component.sendMessage();
    tick();

    const msgs = component.activeMessages();
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0].sender).toBe('user');
    expect(msgs[0].text).toBe('What is Angular?');
  }));

  it('sets chatDisabled when limit is reached', fakeAsync(() => {
    mockAppService.aiChat.and.returnValue(
      of({ limitReached: true, response: '', sessionId: 'sess-1' })
    );
    component.newMessage.set('hi');
    component.sendMessage();
    tick();

    expect(component.chatDisabled()).toBeTrue();
  }));

  it('clears all history on clearAllHistory()', fakeAsync(() => {
    component.clearAllHistory();
    tick();
    expect(component.sessions()).toEqual([]);
  }));
});
