import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { AnalyticsService } from 'src/app/shared/services/analytics.service';

interface MetricCard { icon: string; label: string; value: string; delta: string; positive: boolean; color: string; }
interface PageRow     { path: string; views: number; }
interface BarItem     { pct: number; }

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAnalyticsComponent implements OnInit {
  private analyticsService = inject(AnalyticsService);

  loading = signal(true);
  error   = signal('');

  metrics  = signal<MetricCard[]>([]);
  chartData = signal<number[]>([]);
  devices  = signal<{ label: string; pct: number; color: string }[]>([]);
  sources  = signal<{ label: string; pct: number; color: string }[]>([]);
  topPages = signal<PageRow[]>([]);

  private readonly DEVICE_COLORS = ['#10B981', '#6366F1', '#06B6D4'];
  private readonly SOURCE_COLORS = ['#10B981', '#6366F1', '#F59E0B', '#06B6D4'];

  ngOnInit(): void {
    this.analyticsService.getDashboard().subscribe({
      next: (res: any) => {
        const d = res?.data ?? res ?? {};
        this._mapDashboard(d);
        this.loading.set(false);
      },
      error: () => {
        this._useFallback();
        this.loading.set(false);
      },
    });
  }

  barHeight(v: number): number { return Math.round(v / 100 * 88); }

  private _mapDashboard(d: any): void {
    // Visitor stats → metric cards
    const vs = d.visitorStats ?? {};
    this.metrics.set([
      { icon: 'visibility',    label: 'Page Views',      value: this._fmt(vs.pageViews ?? 0),             delta: '',    positive: true,  color: '#10B981' },
      { icon: 'people',        label: 'Unique Visitors', value: this._fmt(vs.totalUsers ?? vs.newUsers ?? 0), delta: '', positive: true,  color: '#6366F1' },
      { icon: 'timer',         label: 'Avg. Session',    value: this._secs(vs.avgSessionDuration ?? 0),   delta: '',    positive: true,  color: '#06B6D4' },
      { icon: 'trending_down', label: 'Bounce Rate',     value: `${(vs.bounceRate ?? 0).toFixed(1)}%`,    delta: '',    positive: true,  color: '#F59E0B' },
    ]);

    // Page views time series → chart bars (normalise to 0–100)
    const pv: any[] = d.pageViews ?? [];
    if (pv.length) {
      const max = Math.max(...pv.map((p: any) => p.pageViews ?? 0), 1);
      this.chartData.set(pv.slice(-14).map((p: any) => Math.round((p.pageViews ?? 0) / max * 100)));
    }

    // Devices
    const devRaw: any[] = d.devices ?? [];
    const devTotal = devRaw.reduce((s, d) => s + (d.sessions ?? d.users ?? 0), 0) || 1;
    this.devices.set(devRaw.slice(0, 3).map((d: any, i: number) => ({
      label: d.device ?? d.deviceCategory ?? `Device ${i + 1}`,
      pct:   Math.round((d.sessions ?? d.users ?? 0) / devTotal * 100),
      color: this.DEVICE_COLORS[i] ?? '#999',
    })));

    // Traffic sources
    const srcRaw: any[] = d.traffic ?? [];
    const srcTotal = srcRaw.reduce((s, t) => s + (t.sessions ?? 0), 0) || 1;
    this.sources.set(srcRaw.slice(0, 4).map((t: any, i: number) => ({
      label: t.source ?? t.channelGroup ?? `Source ${i + 1}`,
      pct:   Math.round((t.sessions ?? 0) / srcTotal * 100),
      color: this.SOURCE_COLORS[i] ?? '#999',
    })));

    // Top pages
    const pages: any[] = d.topPages ?? [];
    this.topPages.set(pages.slice(0, 5).map((p: any) => ({
      path:  p.path ?? p.pagePath ?? '/',
      views: p.views ?? p.pageViews ?? 0,
    })));
  }

  private _useFallback(): void {
    this.metrics.set([
      { icon: 'visibility',    label: 'Page Views',      value: '—', delta: '', positive: true,  color: '#10B981' },
      { icon: 'people',        label: 'Unique Visitors', value: '—', delta: '', positive: true,  color: '#6366F1' },
      { icon: 'timer',         label: 'Avg. Session',    value: '—', delta: '', positive: true,  color: '#06B6D4' },
      { icon: 'trending_down', label: 'Bounce Rate',     value: '—', delta: '', positive: true,  color: '#F59E0B' },
    ]);
    this.chartData.set([42, 58, 35, 71, 55, 83, 64, 78, 52, 91, 68, 74, 88, 95]);
    this.devices.set([
      { label: 'Desktop', pct: 58, color: '#10B981' },
      { label: 'Mobile',  pct: 34, color: '#6366F1' },
      { label: 'Tablet',  pct:  8, color: '#06B6D4' },
    ]);
    this.sources.set([
      { label: 'Organic Search', pct: 44, color: '#10B981' },
      { label: 'Direct',         pct: 31, color: '#6366F1' },
      { label: 'Social',         pct: 18, color: '#F59E0B' },
      { label: 'Referral',       pct:  7, color: '#06B6D4' },
    ]);
    this.topPages.set([
      { path: '/',          views: 0 },
      { path: '/projects',  views: 0 },
      { path: '/about',     views: 0 },
      { path: '/posts',     views: 0 },
    ]);
  }

  private _fmt(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }

  private _secs(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}m ${sec}s`;
  }
}
