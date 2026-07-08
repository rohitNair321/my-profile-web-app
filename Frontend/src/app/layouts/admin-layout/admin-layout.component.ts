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
import { filter, Subject, Subscription, take, takeUntil } from 'rxjs';
import { CommonApp } from 'src/app/core/services/common';
import { AdminSideNavComponent } from 'src/app/features/admin-view/admin-side-nav/admin-side-nav.component';
import { AdminTopbarComponent } from 'src/app/features/admin-view/admin-topbar/admin-topbar.component';
import { ActivityApiService } from 'src/app/core/services/activity-api.service';
import { SchedulerNotificationService } from 'src/app/core/services/scheduler-notification.service';
import { PostService } from 'src/app/core/services/post.service';

const MOBILE_BREAKPOINT = 900;

const PAGE_LABELS: Record<string, string> = {
  overview:      'Dashboard',
  planner:       'Planner',
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

  private activityApi:   ActivityApiService;
  private schedNotifSvc: SchedulerNotificationService;
  private postApi:       PostService;
  private _schedSub: Subscription | null = null;

  constructor(
    public override injector: Injector,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    super(injector);
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.activityApi   = injector.get(ActivityApiService);
    this.schedNotifSvc = injector.get(SchedulerNotificationService);
    this.postApi       = injector.get(PostService);

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

      // Restore profile on page refresh — initiateApp() only restores auth state,
      // not the profile, so the topbar would fall back to "Admin" without this.
      if (!this.appService.profile()) {
        this.appService.getProfile().pipe(take(1)).subscribe();
      }
    }

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe(() => this.updatePageTitle());

    this.updatePageTitle();

    this.appService.getNotifications().pipe(take(1)).subscribe({
      next: (notifications) => {
        if ((notifications?.unreadCount ?? 0) > 0) {
          const count = notifications.unreadCount;
          this.alertService.showAlert(
            `You have ${count} unread notification${count > 1 ? 's' : ''}`,
            'info'
          );
        }
      },
      error: () => {},
    });

    if (this.isBrowser) {
      this._checkPublishedWhileAway();
      this._checkUpcomingScheduled();
      this._connectRealtimePublish();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this._schedSub?.unsubscribe();
    this.schedNotifSvc.disconnect();
  }

  // ── Scheduled-post notifications ─────────────────────────────

  /** Posts published in the background while the admin was away. Shown once per
   *  event (id-based via SchedulerNotificationService) — never re-notifies for
   *  the same publish, only for newly-scheduled posts. */
  private _checkPublishedWhileAway(): void {
    this.activityApi.getSchedulerEvents(20).subscribe({
      next: d => {
        const unseen    = this.schedNotifSvc.filterUnseen(d.items ?? []);
        if (unseen.length === 0) return;

        const published = unseen.filter(i => i.event_type === 'scheduled_post_published');
        const failed    = unseen.filter(i => i.event_type === 'scheduled_post_failed');

        // Mark everything we're about to surface as seen so it won't show again
        this.schedNotifSvc.markSeen(unseen.map(i => i.id));

        if (published.length > 0) {
          const firstTitle = published[0].meta?.['title'] ?? 'A scheduled post';
          this.alertService.success(
            published.length === 1
              ? `"${firstTitle}" was published while you were away.`
              : `${published.length} scheduled posts were published while you were away.`,
            {
              title: 'Scheduled publishing',
              icon: 'rocket_launch',
              duration: 10000,
              action: {
                label: 'View details',
                handler: () => this.router.navigate(['/admin/overview']),
              },
            }
          );
        }
        if (failed.length > 0) {
          this.alertService.warning(
            `${failed.length} scheduled publish${failed.length > 1 ? 'es' : ''} failed. Check the Overview panel.`,
            { title: 'Scheduled publishing', duration: 0 }
          );
        }
      },
      error: () => {},
    });
  }

  /** Info alert when a scheduled post is due to publish within 15 minutes */
  private _checkUpcomingScheduled(): void {
    this.postApi.getAllAdmin({ status: 'scheduled', limit: 10 }).subscribe({
      next: res => {
        const SOON_MS = 15 * 60 * 1000;
        const now = Date.now();
        for (const p of res.data?.posts ?? []) {
          if (!p.scheduled_at) continue;
          const untilMs = new Date(p.scheduled_at).getTime() - now;
          if (untilMs > 0 && untilMs <= SOON_MS) {
            const mins = Math.max(1, Math.round(untilMs / 60000));
            this.alertService.info(
              `"${p.title}" publishes in ~${mins} minute${mins > 1 ? 's' : ''}.`,
              { title: 'Upcoming scheduled post', icon: 'schedule_send', duration: 10000 }
            );
          }
        }
      },
      error: () => {},
    });
  }

  /** Live SSE toast when the scheduler publishes a post while the admin is on an admin page */
  private _connectRealtimePublish(): void {
    this.schedNotifSvc.connect();
    this._schedSub = this.schedNotifSvc.published$.subscribe(ev => {
      this.alertService.success(`Post published: "${ev.title}"`, { icon: 'rocket_launch' });
    });
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
