import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Injector,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonApp } from 'src/app/core/services/common';

@Component({
  selector: 'app-admin-topbar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './admin-topbar.component.html',
  styleUrls: ['./admin-topbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTopbarComponent extends CommonApp {
  @Input() collapsed   = false;
  @Input() isMobile    = false;
  @Input() pageTitle   = '';
  @Input() adminDark   = true;
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() toggleDark    = new EventEmitter<void>();
  @Output() logout        = new EventEmitter<void>();

  notifications = computed(() => this.appService.notifications());
  profile       = computed(() => this.appService.profile());

  showDropdown = signal(false);

  get adminName(): string {
    return this.profile()?.full_name ?? 'Admin';
  }

  get adminInitials(): string {
    const name = this.adminName;
    const parts = name.split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }

  constructor(public override injector: Injector) {
    super(injector);
  }

  onToggle(): void {
    this.toggleSidebar.emit();
  }

  onToggleDark(): void {
    this.toggleDark.emit();
  }

  onLogout(): void {
    this.showDropdown.set(false);
    this.logout.emit();
  }

  goToNotifications(): void {
    this.router.navigate(['/admin/notifications']);
  }
}
