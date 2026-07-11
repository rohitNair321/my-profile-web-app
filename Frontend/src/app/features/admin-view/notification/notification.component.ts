// notification.component.ts
import { Component, computed, Injector, OnDestroy, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { BadgeModule } from 'primeng/badge';
import { TimeAgoPipe } from '../../../shared/pipes/time.pipe';
import { CommonApp } from 'src/app/core/services/common';
import { Subject } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, AccordionModule, ButtonModule, OverlayBadgeModule, BadgeModule, TimeAgoPipe],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationComponent extends CommonApp implements OnInit, OnDestroy {


  private destroy$ = new Subject<void>();
  notifications = computed(() => {
    return (
      this.appService.notifications()
    );
  });
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

  ngOnInit() {
    if (!this.notifications()) {
      this.appService.getNotifications().pipe(take(1)).subscribe();
    }
  }

  // ── AI reply draft ───────────────────────────────────────────
  aiReplyFor = signal<string | null>(null); // message id whose draft box is open
  aiReplyText = signal<string>('');
  aiReplyLoading = signal(false);

  toggleOpen(id: string): void {
    this.openId = this.openId === id ? null : id;
  }

  draftAiReply(note: any, event: Event): void {
    event.stopPropagation();
    this.aiReplyFor.set(note.id);
    this.aiReplyText.set('');
    this.aiReplyLoading.set(true);
    this.appService.aiReplyDraft({
      name:    `${note.first_name ?? ''} ${note.last_name ?? ''}`.trim(),
      email:   note.email,
      message: note.message,
    }).pipe(take(1)).subscribe({
      next: (res) => {
        this.aiReplyText.set(res?.reply ?? '');
        this.aiReplyLoading.set(false);
      },
      error: (err) => {
        this.aiReplyLoading.set(false);
        this.alertService.showAlert(err?.error?.message || 'Failed to draft reply.', 'error');
      },
    });
  }

  closeAiReply(event?: Event): void {
    event?.stopPropagation();
    this.aiReplyFor.set(null);
    this.aiReplyText.set('');
  }

  copyAiReply(event: Event): void {
    event.stopPropagation();
    const text = this.aiReplyText();
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => this.alertService.showAlert('Reply copied to clipboard.', 'success'),
      () => this.alertService.showAlert('Could not copy.', 'error'),
    );
  }

  sendAiReply(note: any, event: Event): void {
    event.stopPropagation();
    const subject = encodeURIComponent(`Re: your message`);
    const body = encodeURIComponent(this.aiReplyText());
    window.location.href = `mailto:${note.email}?subject=${subject}&body=${body}`;
  }

  markAsRead(id: string, event: Event) {
    event.stopPropagation(); // Prevent accordion from toggling
    this.appService.markMessageAsRead(id).subscribe(() => {

    });
  }

  deleteMessage(id: string, event: Event) {
    event.stopPropagation(); // Prevent accordion from toggling
    this.appService.deleteMessage(id).subscribe(() => {

    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}