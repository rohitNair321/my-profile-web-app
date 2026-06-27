import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  Inject,
  Injector,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, RouterOutlet } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { CommonApp } from 'src/app/core/services/common';
import { AdminSideNavComponent } from 'src/app/features/admin-view/admin-side-nav/admin-side-nav.component';
import { AdminTopbarComponent } from 'src/app/features/admin-view/admin-topbar/admin-topbar.component';

const MOBILE_BREAKPOINT = 900;

const PAGE_LABELS: Record<string, string> = {
  overview:      'Dashboard',
  settings:      'Profile',
  profile:       'Profile',
  experience:    'Experience',
  projects:      'Projects',
  skills:        'Skills',
  themes:        'Themes',
  posts:         'Posts',
  about:         'About Me',
  notifications: 'Notifications',
  ai:            'AI Usage',
  analytics:     'Analytics',
  security:      'Security',
  social:        'Social Links',
  help:          'Help',
};

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, AdminSideNavComponent, AdminTopbarComponent],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent extends CommonApp implements OnInit, OnDestroy {
  isSidebarCollapsed  = signal(false);
  isMobile            = signal(false);
  isMobileSidebarOpen = signal(false);
  currentPageTitle    = signal('Dashboard');

  // Mirrors ThemeService.isDark() — drives the topbar sun/moon icon
  adminDark = signal(false);

  private readonly isBrowser: boolean;
  private readonly destroy$ = new Subject<void>();

  constructor(
    public override injector: Injector,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    super(injector);
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      this.isMobile.set(mobile);
      this.isSidebarCollapsed.set(window.innerWidth < 1024);

      // Seed from ThemeService (source of truth for dark mode)
      this.adminDark.set(this.themeService.isDark());

      // Keep in sync when ThemeService dark mode changes externally
      effect(() => {
        this.adminDark.set(this.themeService.isDark());
      }, { injector: this.injector });
    }
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      // Apply saved theme from profile as soon as profile signal populates
      effect(() => {
        const profile = this.appService.profile();
        if (profile) {
          this.applyThemeFromProfile(profile);
        }
      }, { injector: this.injector });
    }

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe(() => this.updatePageTitle());

    this.updatePageTitle();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.isBrowser) return;
    const nowMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    this.isMobile.set(nowMobile);
    if (nowMobile) {
      this.isMobileSidebarOpen.set(false);
    }
  }

  onToggleSidebar(): void {
    if (this.isMobile()) {
      this.isMobileSidebarOpen.set(!this.isMobileSidebarOpen());
    } else {
      this.isSidebarCollapsed.set(!this.isSidebarCollapsed());
    }
  }

  onCollapseChange(collapsed: boolean): void {
    this.isSidebarCollapsed.set(collapsed);
  }

  onCloseMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  onToggleDark(): void {
    this.themeService.toggleDarkMode();
    // adminDark syncs automatically via the effect in the constructor
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  private updatePageTitle(): void {
    const segments = this.router.url.split('/').filter(Boolean);
    const last = segments[segments.length - 1]?.split('?')[0] ?? 'overview';
    this.currentPageTitle.set(PAGE_LABELS[last] ?? 'Admin');
  }
}
