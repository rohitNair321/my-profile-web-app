import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  Output,
  computed,
  inject,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonApp } from 'src/app/core/services/common';
import { AccessApiService } from 'src/app/core/services/access-api.service';

export interface AdminNavItem {
  icon: string;
  label: string;
  route: string;
  key: string;
  badge?: boolean;
  children?: AdminNavItem[]; // optional sub-menu
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { icon: 'dashboard', label: 'Overview', route: '/admin/overview', key: 'overview' },
  { icon: 'view_kanban', label: 'Planner', route: '/admin/planner', key: 'planner' },
  { icon: 'person', label: 'Profile', route: '/admin/profile', key: 'profile' },
  { icon: 'work', label: 'Experience', route: '/admin/experience', key: 'experience' },
  { icon: 'folder_special', label: 'Projects', route: '/admin/projects', key: 'projects' },
  { icon: 'psychology', label: 'Skills', route: '/admin/skills', key: 'skills' },
  { icon: 'palette', label: 'Themes', route: '/admin/themes', key: 'themes' },
  { icon: 'article', label: 'Learning Posts', route: '/admin/blog', key: 'blog' },
  { icon: 'edit_note', label: 'About Me', route: '/admin/about', key: 'about' },
  { icon: 'notifications', label: 'Notifications', route: '/admin/notification', key: 'notification', badge: true },
  { icon: 'smart_toy', label: 'AI Usage', route: '/admin/ai', key: 'ai' },
  { icon: 'bar_chart', label: 'Analytics', route: '/admin/analytics', key: 'analytics' },
  { icon: 'security', label: 'Security', route: '/admin/security', key: 'security' },
  { icon: 'share', label: 'Social Links', route: '/admin/social', key: 'social' },
  { icon: 'admin_panel_settings', label: 'Access', route: '/admin/access', key: 'access' },
];

@Component({
  selector: 'app-admin-side-nav',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './admin-side-nav.component.html',
  styleUrls: ['./admin-side-nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSideNavComponent extends CommonApp implements OnInit, OnDestroy {
  @Input() collapsed = false;
  @Input() isMobile = false;
  @Input() isMobileOpen = false;
  @Output() collapseChange = new EventEmitter<boolean>();
  @Output() closeMobile = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  readonly navItems = ADMIN_NAV_ITEMS;
  private accessApi = inject(AccessApiService);
  notifications = computed(() => this.appService.notifications());

  /**
   * Role-aware sidebar:
   *  - SUPERADMIN → every item + sub-menu (full access to the console)
   *  - ADMIN / USER → only the pages/sub-menus granted to them (rest hidden)
   */
  visibleNavItems = computed(() => {
    if (this.appService.role() === 'SUPERADMIN') return this.navItems;
    const allowed = new Set(this.appService.accessiblePages());
    return this._filterByAccess(this.navItems, allowed);
  });

  /** Keep items whose key is granted; keep a parent if any child survives. */
  private _filterByAccess(items: AdminNavItem[], allowed: Set<string>): AdminNavItem[] {
    const out: AdminNavItem[] = [];
    for (const item of items) {
      if (item.key === 'access') continue; // super-admin-only console
      const kids = item.children ? this._filterByAccess(item.children, allowed) : undefined;
      if (allowed.has(item.key) || (kids && kids.length)) {
        out.push(kids ? { ...item, children: kids } : item);
      }
    }
    return out;
  }

  /**
   * On mobile the sidebar is an off-canvas drawer and must ALWAYS render
   * expanded (icons + labels) — the desktop `collapsed` state must not leak in.
   */
  get effectiveCollapsed(): boolean {
    return this.isMobile ? false : this.collapsed;
  }

  onHeaderToggle(): void {
    if (this.isMobile) {
      this.closeMobile.emit();   // burger in the topbar reopens it
    } else {
      this.toggleCollapse();
    }
  }

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    // Populate the accessible-page set (drives USER-tier sidebar filtering).
    this.accessApi.getMyPages().subscribe({
      next: a => this.appService.setAccessiblePages(a.pages),
      error: () => { /* non-admin or transient — leave as-is */ },
    });
  }
  ngOnDestroy(): void { }

  toggleCollapse(): void {
    this.collapseChange.emit(!this.collapsed);
  }

  onNavClick(): void {
    if (this.isMobile) {
      this.closeMobile.emit();
    }
  }

  onLogout(): void {
    this.logout.emit();
  }
}
