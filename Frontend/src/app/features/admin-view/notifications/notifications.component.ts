import { ChangeDetectionStrategy, Component, computed, Injector, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeAgoPipe } from 'src/app/shared/pipes/time.pipe';
import { CommonApp } from 'src/app/core/services/common';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationComponent extends CommonApp implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  notifications = computed(() => this.appService.notifications());

  openId: string | null = null;
  filter: 'all' | 'unread' | 'read' = 'all';

  get filteredNotifications() {
    const list = this.notifications()?.notificationList ?? [];
    if (this.filter === 'unread') return list.filter(n => !n.is_read);
    if (this.filter === 'read')   return list.filter(n => n.is_read);
    return list;
  }

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    // Notifications load asynchronously via AppService polling — no redirect needed
  }

  toggleOpen(id: string): void {
    this.openId = this.openId === id ? null : id;
  }

  markAsRead(id: string, event: Event): void {
    event.stopPropagation();
    this.appService.markMessageAsRead(id).subscribe();
  }

  deleteMessage(id: string, event: Event): void {
    event.stopPropagation();
    this.appService.deleteMessage(id).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
