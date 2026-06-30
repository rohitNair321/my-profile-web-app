import {
  Component,
  HostListener,
  Injector,
  OnInit,
  OnDestroy,
  computed,
  signal,
  PLATFORM_ID,
  Inject,
  ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { THEME_NAME_MAP } from 'src/app/core/config/theme.config';
import { CommonApp } from 'src/app/core/services/common';
import { ChristmasAnimationComponent } from 'src/app/core/theme/ThemeAnimationsComponent/christmas-animation/christmas-animation.component';
import { NewYearAnimationComponent } from 'src/app/core/theme/ThemeAnimationsComponent/new-year-animation/new-year-animation.component';
import { FooterComponent } from 'src/app/shared/components/footer/footer.component';
import { NavigationComponent } from 'src/app/shared/components/navigation/navigation.component';
import { SidebarComponent } from 'src/app/shared/components/sidebar/sidebar.component';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

const MOBILE_BREAKPOINT = 900;

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    FormsModule,
    NavigationComponent,
    SidebarComponent,
    FooterComponent,
    ChristmasAnimationComponent,
    NewYearAnimationComponent,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent extends CommonApp implements OnInit, OnDestroy {

  isSettingsPanelOpen = false;
  showScrollTop = signal(false);
  private isBrowser: boolean;

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

  constructor(
    public override injector: Injector,
    private confirmationService: ConfirmationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    super(injector);
    this.isBrowser = isPlatformBrowser(this.platformId);

    this.appConfig.theme.name = 'theme-6';
    this.appConfig.appConfiguration.type = 'sidebar';   // 'sidebar' | 'navbar'
    this.appConfig.appConfiguration.theme = 'light';
    this.appConfig.appConfiguration.sidebarPosition = 'left';      // always left
    this.appConfig.appConfiguration.logoLocationHeader = false;
    this.appConfig.appConfiguration.collapsed = true;        // sidebar icon-only by default
    this.appConfig.appConfiguration.showSidebarToggle = true;
    this.appConfig.appConfiguration.showAgentChat = true;
    this.appConfig.appConfiguration.showUserProfileView = this.appService.role() === 'ADMIN';
    this.appConfig.appConfiguration.showNotifications = this.appService.role() === 'ADMIN';
    this.appConfig.appConfiguration.isMobile = this._isMobile();
  }

  // ── Lifecycle ────────────────────────────────────────────────

  get isDark(): boolean { return this.themeService.isDark(); }

  ngOnInit(): void {
    const resolvedId = THEME_NAME_MAP[this.appConfig.theme.name ?? 'theme-5'] ?? 'tron';
    this.themeService.setTheme(resolvedId);
    this.startSessionTimer();
    this._applyRoleLayout();

    if (this.isBrowser) {
      const savedAccent = localStorage.getItem('rn-pref-accent');
      if (savedAccent) this.setAccent(savedAccent);

      const savedSize = localStorage.getItem('rn-pref-size') as 'sm' | 'md' | 'lg' | null;
      if (savedSize) this.setTextSize(savedSize);

      if (localStorage.getItem('rn-pref-motion') === 'true') this.toggleReduceMotion();
    }
  }

  private _applyRoleLayout(): void {
    const isAdmin = this.appService.role() === 'ADMIN';
    this.appConfig.appConfiguration.type = isAdmin ? 'sidebar' : 'navbar';
    this.appConfig.appConfiguration.showUserProfileView = isAdmin;
    this.appConfig.appConfiguration.showNotifications = isAdmin;
  }

  ngOnDestroy(): void {
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

  startSessionTimer() {
    if (this.appService.role() !== 'ADMIN') {
      setTimeout(() => {
        this.confirmationService.confirm({
          header: 'App session expiring',
          message: 'Your session is about to expire. Do you want to refresh the session?',
          acceptLabel: 'Ok',
          acceptIcon: "none",
          rejectVisible: false,
          closeOnEscape: false,
          closable: false,
          accept: () => {
            window.location.reload();
          },
        });
      }, 10 * 60 * 1000);
    }
  }
}