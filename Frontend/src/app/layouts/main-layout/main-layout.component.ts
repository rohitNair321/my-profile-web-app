import {
  Component,
  HostListener,
  Injector,
  OnInit,
  OnDestroy,
  computed,
  effect,
  signal,
  PLATFORM_ID,
  Inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { THEME_NAME_MAP } from 'src/app/core/config/theme.config';
import { CommonApp } from 'src/app/core/services/common';
import { ChristmasAnimationComponent } from 'src/app/core/theme/ThemeAnimationsComponent/christmas-animation/christmas-animation.component';
import { NewYearAnimationComponent } from 'src/app/core/theme/ThemeAnimationsComponent/new-year-animation/new-year-animation.component';
import { FooterComponent } from 'src/app/shared/components/footer/footer.component';
import { NavigationComponent } from 'src/app/shared/components/navigation/navigation.component';
import { SidebarComponent } from 'src/app/shared/components/sidebar/sidebar.component';
import { ChatBotComponent } from 'src/app/shared/components/chat-bot/chat-bot.component';
import { AuthService } from 'src/app/auth/services/auth.service';
import { SchedulerNotificationService } from 'src/app/core/services/scheduler-notification.service';
import { ConfirmDialogService } from 'src/app/core/services/confirm-dialog.service';
import { PreviewModeService } from 'src/app/core/services/preview-mode.service';
import { Subscription } from 'rxjs';

const MOBILE_BREAKPOINT = 900;

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    FormsModule,
    NavigationComponent,
    SidebarComponent,
    FooterComponent,
    ChatBotComponent,
    ChristmasAnimationComponent,
    NewYearAnimationComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent extends CommonApp implements OnInit, OnDestroy {

  isSettingsPanelOpen = false;
  showScrollTop = signal(false);
  private isBrowser: boolean;

  // ── Password expiry ───────────────────────────────────────────
  pwdExpired      = signal(false);
  pwdWarning      = signal(false);
  pwdDaysLeft     = signal(30);
  pwdWarnDismissed = signal(false);

  // Modal password form
  modalCurrentPwd  = '';
  modalNewPwd      = '';
  modalConfirmPwd  = '';
  modalShowCurrent = signal(false);
  modalShowNew     = signal(false);
  modalShowConfirm = signal(false);
  modalSaving      = signal(false);
  modalError       = signal('');

  get modalStrength(): number {
    let s = 0;
    if (this.modalNewPwd.length >= 8)           s++;
    if (/[A-Z]/.test(this.modalNewPwd))         s++;
    if (/[0-9]/.test(this.modalNewPwd))         s++;
    if (/[^A-Za-z0-9]/.test(this.modalNewPwd)) s++;
    return s;
  }
  readonly strengthColors = ['', '#EF4444', '#F59E0B', '#F59E0B', '#10B981'];
  readonly strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  // ── Preferences panel state ───────────────────────────────────
  currentAccent   = signal<string>('#10B981');
  currentTextSize = signal<'sm' | 'md' | 'lg'>('md');
  reduceMotion    = signal(false);

  readonly accentOptions = [
    { value: '#10B981', label: 'Emerald' },
    { value: '#6366F1', label: 'Indigo'  },
    { value: '#8B5CF6', label: 'Violet'  },
    { value: '#F59E0B', label: 'Amber'   },
    { value: '#EF4444', label: 'Rose'    },
  ];

  readonly textSizeOptions: Array<{ value: 'sm' | 'md' | 'lg'; label: string }> = [
    { value: 'sm', label: 'S' },
    { value: 'md', label: 'M' },
    { value: 'lg', label: 'L' },
  ];

  availableThemes = computed(() =>
    this.normalizeThemesResponse(this.appService.profile()?.themes ?? [])
  );

  private authSvc: AuthService;
  private schedNotifSvc: SchedulerNotificationService;
  private confirmDialog: ConfirmDialogService;
  readonly preview: PreviewModeService;
  private _schedSub: Subscription | null = null;

  constructor(
    public override injector: Injector,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    super(injector);
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.authSvc = injector.get(AuthService);
    this.schedNotifSvc = injector.get(SchedulerNotificationService);
    this.confirmDialog = injector.get(ConfirmDialogService);
    this.preview = injector.get(PreviewModeService);

    this.appConfig.theme.name = 'theme-6';
    this.appConfig.appConfiguration.theme = 'light';
    this.appConfig.appConfiguration.sidebarPosition = 'left';      // always left
    this.appConfig.appConfiguration.logoLocationHeader = false;
    this.appConfig.appConfiguration.collapsed = true;        // sidebar icon-only by default
    this.appConfig.appConfiguration.showSidebarToggle = true;
    this.appConfig.appConfiguration.showAgentChat = true;
    this.appConfig.appConfiguration.isMobile = this._isMobile();

    // Layout follows the auth role REACTIVELY: admins get the sidebar, guests
    // (incl. right after logout) get the top navbar. An effect keeps it correct
    // even if the role signal settles after this component is created.
    // "View public site" preview overrides an admin session to render the guest
    // shell so the admin can preview the public experience without logging out.
    effect(() => {
      const isAdmin = this.appService.role() === 'ADMIN' && !this.preview.previewPublic();
      this.appConfig.appConfiguration.type = isAdmin ? 'sidebar' : 'navbar';
      this.appConfig.appConfiguration.showUserProfileView = isAdmin;
      this.appConfig.appConfiguration.showNotifications = isAdmin;
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────

  get isDark(): boolean { return this.themeService.isDark(); }

  ngOnInit(): void {
    // "View public site" entry point — a new tab opened with ?view=public turns on
    // the guest-shell preview (persisted so it survives navigation across pages).
    if (this.route.snapshot.queryParamMap.get('view') === 'public') {
      this.preview.enable();
    }

    const resolvedId = THEME_NAME_MAP[this.appConfig.theme.name ?? 'theme-5'] ?? 'tron';
    this.themeService.setTheme(resolvedId);
    this.startSessionTimer();
    this._checkPasswordExpiry();
    this._connectSchedulerNotifications();

    if (this.isBrowser) {
      const savedAccent = localStorage.getItem('rn-pref-accent');
      if (savedAccent) this.setAccent(savedAccent);

      const savedSize = localStorage.getItem('rn-pref-size') as 'sm' | 'md' | 'lg' | null;
      if (savedSize) this.setTextSize(savedSize);

      if (localStorage.getItem('rn-pref-motion') === 'true') this.toggleReduceMotion();
    }
  }

  ngOnDestroy(): void {
    this._schedSub?.unsubscribe();
    this.schedNotifSvc.disconnect();
    if (this._sessionTimerHandle) clearTimeout(this._sessionTimerHandle);
  }

  initSidebarMenu(collapsed: boolean): void {
    this.appConfig.appConfiguration.collapsed = collapsed;
  }

  toggleSettingsPanel(): void {
    this.isSettingsPanelOpen = !this.isSettingsPanelOpen;
  }

  onNavigationTypeChange(type: 'sidebar' | 'navbar'): void {
    this.appConfig.appConfiguration.type = type;

    if (type === 'sidebar') {
      this.appConfig.appConfiguration.collapsed = true;
    }

    if (this.appConfig.appConfiguration.isMobile) {
      this.isSettingsPanelOpen = false;
    }
  }

  toggleDark(): void {
    this.themeService.toggleDarkMode();
  }

  setAccent(value: string): void {
    this.currentAccent.set(value);
    if (this.isBrowser) {
      document.documentElement.style.setProperty('--primary', value);
      localStorage.setItem('rn-pref-accent', value);
    }
  }

  setTextSize(size: 'sm' | 'md' | 'lg'): void {
    this.currentTextSize.set(size);
    if (this.isBrowser) {
      const map: Record<string, string> = { sm: '14px', md: '16px', lg: '18px' };
      document.documentElement.style.fontSize = map[size];
      localStorage.setItem('rn-pref-size', size);
    }
  }

  toggleReduceMotion(): void {
    this.reduceMotion.update(r => !r);
    if (this.isBrowser) {
      document.documentElement.classList.toggle('reduce-motion', this.reduceMotion());
      document.documentElement.style.setProperty('--anim-dur', this.reduceMotion() ? '0s' : '1s');
      localStorage.setItem('rn-pref-motion', String(this.reduceMotion()));
    }
  }

  onThemeChange(theme: { id: string; name: string }): void {
    this.appConfig.theme.name = theme.name;
    this.themeService.setTheme(theme.id);
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.isBrowser) {
      this.showScrollTop.set(window.scrollY > 500);
    }
  }

  scrollTop(): void {
    if (this.isBrowser) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    const wasMobile = this.appConfig.appConfiguration.isMobile;
    const nowMobile = this._isMobile();

    if (wasMobile === nowMobile) { return; }   // no state change — skip

    this.appConfig.appConfiguration.isMobile = nowMobile;

    if (nowMobile) {
      this.appConfig.appConfiguration.collapsed = true;
    }
  }

  // ── Private helpers ───────────────────────────────────────────

  private _isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
  }

  private _connectSchedulerNotifications(): void {
    if (!this.isBrowser || this.appService.role() !== 'ADMIN') return;
    this.schedNotifSvc.connect();
    this._schedSub = this.schedNotifSvc.published$.subscribe(event => {
      this.alertService.showAlert(
        `Post published: "${event.title}"`,
        'success'
      );
    });
  }

  private _checkPasswordExpiry(): void {
    if (this.appService.role() !== 'ADMIN') return;
    this.authSvc.getPasswordStatus().subscribe({
      next: s => {
        this.pwdDaysLeft.set(s.daysUntilExpiry);
        this.pwdExpired.set(s.isExpired);
        this.pwdWarning.set(s.isWarning);
      },
      error: () => {},
    });
  }

  onModalSavePassword(): void {
    this.modalError.set('');
    const email = this.appService.profile()?.email ?? this.authSvc.user()?.email ?? '';
    if (!this.modalCurrentPwd || !this.modalNewPwd || !this.modalConfirmPwd) {
      this.modalError.set('All fields are required.'); return;
    }
    if (this.modalNewPwd !== this.modalConfirmPwd) {
      this.modalError.set('New passwords do not match.'); return;
    }
    if (this.modalStrength < 2) {
      this.modalError.set('Password is too weak.'); return;
    }
    this.modalSaving.set(true);
    this.authSvc.updatePassword({
      email,
      currentPassword: this.modalCurrentPwd,
      newPassword: this.modalNewPwd,
    }).subscribe({
      next: () => {
        this.modalSaving.set(false);
        this.pwdExpired.set(false);
        // Force logout so admin re-authenticates with new password
        this.authSvc.logout();
      },
      error: (err: any) => {
        this.modalSaving.set(false);
        this.modalError.set(err?.error?.message ?? 'Failed to update password.');
      },
    });
  }

  private _sessionTimerHandle: ReturnType<typeof setTimeout> | null = null;

  startSessionTimer() {
    if (this.appService.role() !== 'ADMIN' && this.isBrowser) {
      this._sessionTimerHandle = setTimeout(() => {
        this.confirmDialog.info(
          'Your session is about to expire. Refresh to continue browsing.',
          { title: 'Session expiring', icon: 'schedule', confirmLabel: 'Refresh session' }
        ).then(confirmed => {
          if (confirmed) window.location.reload();
        });
      }, 10 * 60 * 1000);
    }
  }
}