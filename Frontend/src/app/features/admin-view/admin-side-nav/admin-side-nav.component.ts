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
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonApp } from 'src/app/core/services/common';

export interface AdminNavItem {
  icon: string;
  label: string;
  route: string;
  key: string;
  badge?: boolean;
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
  notifications = computed(() => this.appService.notifications());

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void { }
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
