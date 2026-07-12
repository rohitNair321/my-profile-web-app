import { AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, Injector, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CommonApp } from 'src/app/core/services/common';
import { ChatApiService, UsageResponse } from 'src/app/core/services/chat-api.service';
import { ActivityApiService, ActivityFeedItem } from 'src/app/core/services/activity-api.service';
import { TaskService } from 'src/app/core/services/task.service';
import { InProgressAlert } from 'src/app/features/admin-view/planner/models/task.model';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

interface StatCard { icon: string; label: string; value: string; color: string; }

/** A single row in the dashboard "Recent Activity" card */
interface ActivityRow {
  kind: 'todo' | 'post_published' | 'post_failed';
  icon: string;
  iconColor: string;
  text: string;
  time: string | null;
  route: string;
}

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
  private taskService = inject(TaskService);

  @ViewChild('barCanvas') barCanvas!: ElementRef<HTMLCanvasElement>;
  private _chart: Chart | null = null;

  notifications = computed(() => this.appService.notifications());
  profile       = computed(() => this.appService.profile());

  stats     = signal<StatCard[]>(this._placeholderStats());
  chartData = signal<number[]>([65, 48, 72, 58, 81, 63, 77, 55, 69, 84, 71, 60, 88, 74]);

  // Recent Activity card — todo (in-progress) + post/scheduler events
  activityRows = signal<ActivityRow[]>([]);
  activityLoaded = signal(false);

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this._loadActivity();
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

  /** Build the Recent Activity feed: in-progress todo (top) + recent post/scheduler events */
  private _loadActivity(): void {
    if (this.appService.role() !== 'ADMIN') return;

    forkJoin({
      todo:   this.taskService.getInProgressAlert().pipe(catchError(() => of(null))),
      events: this.activityApi.getSchedulerEvents(6).pipe(catchError(() => of({ items: [] as ActivityFeedItem[], total: 0, page: 1, limit: 6 }))),
    }).subscribe(({ todo, events }) => {
      const rows: ActivityRow[] = [];

      if (todo) rows.push(this._todoRow(todo));

      for (const item of events.items ?? []) {
        rows.push(this._eventRow(item));
      }

      this.activityRows.set(rows);
      this.activityLoaded.set(true);
    });
  }

  private _todoRow(a: InProgressAlert): ActivityRow {
    return {
      kind:      'todo',
      icon:      a.overdue ? 'warning' : 'timer',
      iconColor: a.overdue ? 'var(--warning, #F59E0B)' : 'var(--success, #10B981)',
      text:      a.overdue
        ? `"${a.title}" is in progress and overdue`
        : `"${a.title}" is in progress`,
      time:      null,
      route:     '/admin/planner',
    };
  }

  private _eventRow(item: ActivityFeedItem): ActivityRow {
    const title = item.meta?.['title'] ?? 'A scheduled post';
    const ok = item.event_type === 'scheduled_post_published';
    return {
      kind:      ok ? 'post_published' : 'post_failed',
      icon:      ok ? 'check_circle' : 'error_outline',
      iconColor: ok ? 'var(--success, #10B981)' : '#EF4444',
      text:      ok ? `"${title}" was published` : `"${title}" failed to publish`,
      time:      this._relTime(item.created_at),
      route:     '/admin/posts',
    };
  }

  private _relTime(iso: string | null): string | null {
    if (!iso) return null;
    const diffMs = Date.now() - new Date(iso).getTime();
    if (isNaN(diffMs)) return null;
    const min = Math.floor(diffMs / 60000);
    if (min < 1)   return 'just now';
    if (min < 60)  return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24)    return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
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
