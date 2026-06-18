// notification.component.ts
import { Component, computed, inject, Injector, OnDestroy, OnInit, signal , ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { BadgeModule } from 'primeng/badge';
import { TimeAgoPipe } from '../../shared/pipes/time.pipe';
import { CommonApp } from 'src/app/core/services/common';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule,AccordionModule, ButtonModule, OverlayBadgeModule, BadgeModule, TimeAgoPipe],
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
  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit() {
    if (!this.notifications()) {
      this.router.navigate(['/app/home']);
    }
  }

  toggleOpen(id: string): void {
    this.openId = this.openId === id ? null : id;
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