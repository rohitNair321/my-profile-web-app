import { AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, Injector, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CommonApp } from 'src/app/core/services/common';
import { ChatApiService, UsageResponse } from 'src/app/core/services/chat-api.service';
import { ActivityApiService, ActivityFeedItem } from 'src/app/core/services/activity-api.service';
import { SchedulerNotificationService } from 'src/app/core/services/scheduler-notification.service';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

interface StatCard { icon: string; label: string; value: string; color: string; }

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [RouterModule, SlicePipe],
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewComponent extends CommonApp implements OnInit, AfterViewInit, OnDestroy {
  private chatApi     = inject(ChatApiService);
  private activityApi = inject(ActivityApiService);
  private schedSvc    = inject(SchedulerNotificationService);

  @ViewChild('barCanvas') barCanvas!: ElementRef<HTMLCanvasElement>;
  private _chart: Chart | null = null;

  notifications = computed(() => this.appService.notifications());
  profile       = computed(() => this.appService.profile());

  stats     = signal<StatCard[]>(this._placeholderStats());
  chartData = signal<number[]>([65, 48, 72, 58, 81, 63, 77, 55, 69, 84, 71, 60, 88, 74]);

  // Scheduler notifications
  schedNotifs  = signal<ActivityFeedItem[]>([]);
  schedVisible = signal(false);

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this._checkSchedulerNotifications();
    this.chatApi.getUsage({ range: '30d' }).subscribe({
      next: (res: UsageResponse) => {
        const s    = res.summary;
        const cost = s?.totalCost ?? 0;
        this.stats.set([
          { icon: 'chat',                   label: 'Sessions',    value: String(res.sessions?.length ?? 0),    color: '#10B981' },
          { icon: 'toll',                   label: 'Tokens Used', value: this._fmtTokens(s?.totalTokens ?? 0), color: '#06B6D4' },
          { icon: 'payments',               label: 'Total Cost',  value: `$${cost.toFixed(2)}`,                color: '#6366F1' },
          { icon: 'account_balance_wallet', label: 'Remaining',   value: `$${(20 - cost).toFixed(2)}`,         color: '#F59E0B' },
        ]);

        const trend = res.trend ?? [];
        if (trend.length) {
          const max = Math.max(...trend.map(t => t.tokens), 1);
          this.chartData.set(trend.slice(-14).map(t => Math.round(t.tokens / max * 100)));
        }
      },
      error: () => { /* keep placeholder stats on failure */ },
    });
  }

  ngAfterViewInit(): void {
    const ctx = this.barCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const data = this.chartData();
    this._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map((_, i) => `D${i + 1}`),
        datasets: [{
          data,
          backgroundColor: 'rgba(16,185,129,0.65)',
          hoverBackgroundColor: 'rgba(6,182,212,0.85)',
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: { display: false },
          y: { display: false, min: 0, max: 100 },
        },
      },
    });

    effect(() => {
      const updated = this.chartData();
      if (this._chart) {
        this._chart.data.datasets[0].data = updated;
        this._chart.data.labels = updated.map((_, i) => `D${i + 1}`);
        this._chart.update('none');
      }
    }, { injector: this.injector });
  }

  ngOnDestroy(): void {
    this._chart?.destroy();
  }

  barHeight(v: number): number { return Math.round(v / 100 * 88); }

  get adminFirstName(): string {
    const parts = (this.profile()?.full_name ?? 'Admin').split(' ');
    return parts[0] ?? 'Admin';
  }

  get recentNotifications() {
    return (this.notifications()?.notificationList ?? []).slice(0, 3);
  }

  getInitials(first: string, last: string): string {
    return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase();
  }

  private _checkSchedulerNotifications(): void {
    if (this.appService.role() !== 'ADMIN') return;

    this.activityApi.getSchedulerEvents(20).subscribe({
      next: d => {
        // Only surface events we haven't shown before (id-based, clock-skew proof).
        const unseen = this.schedSvc.filterUnseen(d.items ?? []);
        if (unseen.length > 0) {
          this.schedNotifs.set(unseen);
          this.schedVisible.set(true);
          // Showing the panel = seen. These exact events never notify again;
          // only a newly-scheduled post (new id) will reappear.
          this.schedSvc.markSeen(unseen.map(i => i.id));
        }
      },
      error: () => {},
    });
  }

  dismissSchedulerNotifs(): void {
    this.schedSvc.markSeen(this.schedNotifs().map(i => i.id));
    this.schedVisible.set(false);
    this.schedNotifs.set([]);
  }

  schedNotifIcon(type: string): string {
    return type === 'scheduled_post_published' ? 'check_circle' : 'error_outline';
  }

  schedNotifMessage(item: ActivityFeedItem): string {
    const title = item.meta?.['title'] ?? 'A scheduled post';
    if (item.event_type === 'scheduled_post_published') {
      return `"${title}" was published successfully.`;
    }
    return `"${title}" failed to publish. Check server logs.`;
  }

  private _placeholderStats(): StatCard[] {
    return [
      { icon: 'chat',                   label: 'Sessions',    value: '…', color: '#10B981' },
      { icon: 'toll',                   label: 'Tokens Used', value: '…', color: '#06B6D4' },
      { icon: 'payments',               label: 'Total Cost',  value: '…', color: '#6366F1' },
      { icon: 'account_balance_wallet', label: 'Remaining',   value: '…', color: '#F59E0B' },
    ];
  }

  private _fmtTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  }
}
