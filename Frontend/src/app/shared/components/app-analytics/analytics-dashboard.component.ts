import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Highcharts from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { Subscription } from 'rxjs';
import { AnalyticsDashboard, AnalyticsService } from '../../services/analytics.service';

// ── CSS token helpers ─────────────────────────────────────────
function cssVar(name: string, fallback = '#888'): string {
  if (typeof document === 'undefined') { return fallback; }
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim() || fallback;
}

function cssVarAlpha(name: string, alpha: number, fallback = '#888'): string {
  const hex = cssVar(name, fallback).replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some(isNaN)) { return fallback; }
  return `rgba(${r},${g},${b},${alpha})`;
}

interface TimeRangeOption { label: string; value: '7days' | '30days' | 'custom'; }

interface TopPageRow {
  rank: number;
  title: string;
  path: string;
  pageViews: number;
  avgDuration: number;
  share: number;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HighchartsChartComponent,
    ButtonModule,
    CalendarModule,
    TooltipModule,
    TableModule,
    TagModule,
  ],
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent implements OnInit, OnDestroy {

  readonly Highcharts: typeof Highcharts = Highcharts;

  // ── Chart option signals ──────────────────────────────────────
  pageViewsOptions = signal<Highcharts.Options | null>(null);
  devicesOptions = signal<Highcharts.Options | null>(null);
  trafficOptions = signal<Highcharts.Options | null>(null);
  geoOptions = signal<Highcharts.Options | null>(null);

  // Signal-based updateFlag — reset to false after each render cycle
  updateFlag = signal(false);

  // ── UI state ──────────────────────────────────────────────────
  selectedTimeRange = signal<'7days' | '30days' | 'custom'>('7days');
  customDateRange: Date[] | null = null;

  readonly timeRangeOptions: TimeRangeOption[] = [
    { label: '7 Days', value: '7days' },
    { label: '30 Days', value: '30days' },
    { label: 'Custom', value: 'custom' },
  ];

  // ── Data ──────────────────────────────────────────────────────
  dashboardData = computed(() => this.analyticsService.dashboardData());
  loading = computed(() => this.analyticsService.loading());
  error = computed(() => this.analyticsService.error());

  totalPageViews = computed(() =>
    this.dashboardData()?.pageViews.reduce((s, pv) => s + pv.pageViews, 0) ?? 0
  );

  newUserPercent = computed(() => {
    const d = this.dashboardData()?.visitorStats;
    if (!d?.totalUsers) { return 0; }
    return Math.min(100, (d.newUsers / d.totalUsers) * 100);
  });

  private _maxPageViews = computed(() => {
    const pages = this.dashboardData()?.topPages ?? [];
    return pages.reduce((m, p) => Math.max(m, p.pageViews), 1);
  });

  topPageRows = computed<TopPageRow[]>(() => {
    const pages = this.dashboardData()?.topPages ?? [];
    const max = this._maxPageViews();
    return pages.map((p, i) => ({
      rank: i + 1,
      title: p.title || 'Untitled',
      path: p.path,
      pageViews: p.pageViews,
      avgDuration: p.avgDuration,
      share: Math.round((p.pageViews / max) * 100),
    }));
  });

  private _sub = new Subscription();

  constructor(private analyticsService: AnalyticsService) {
    effect(() => {
      const data = this.dashboardData();
      if (data) { setTimeout(() => this._buildAllCharts(data), 50); }
    });
  }

  ngOnInit(): void { this.loadAnalytics(); }
  ngOnDestroy(): void { this._sub.unsubscribe(); }

  // ── Data loading ──────────────────────────────────────────────
  loadAnalytics(): void {
    const range = this.selectedTimeRange();
    let start = '7daysAgo', end = 'today';
    if (range === '30days') { start = '30daysAgo'; }
    else if (range === 'custom' && this.customDateRange?.length) {
      start = this._fmtDate(this.customDateRange[0]);
      end = this._fmtDate(this.customDateRange[1] ?? this.customDateRange[0]);
    }
    this._sub.add(this.analyticsService.getDashboard(start, end).subscribe());
  }

  changeTimeRange(range: '7days' | '30days' | 'custom'): void {
    this.selectedTimeRange.set(range);
    if (range !== 'custom') { this.loadAnalytics(); }
  }

  applyCustomRange(): void { if (this.customDateRange?.length) { this.loadAnalytics(); } }
  refresh(): void { this.loadAnalytics(); }

  /** Called by (updateChange) output — resets flag so re-render can trigger again */
  onChartUpdateChange(next: boolean): void { this.updateFlag.set(next); }

  // ── Format helpers ────────────────────────────────────────────
  formatNumber(n: number): string { return n.toLocaleString(); }
  formatPercent(v: number): string { return `${(v * 100).toFixed(1)}%`; }
  formatDuration(seconds: number): string {
    if (seconds < 60) { return `${Math.round(seconds)}s`; }
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  }
  pageShare(views: number): number {
    return Math.round((views / this._maxPageViews()) * 100);
  }

  // ── Highcharts shared base options ────────────────────────────
  private _hcBase(): Partial<Highcharts.Options> {
    return {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'inherit' },
        animation: { duration: 500 },
        // reflow=true so Highcharts responds to container size changes
        reflow: true,
      } as Highcharts.ChartOptions,
      credits: { enabled: false },
      exporting: { enabled: false },
      title: { text: undefined },
      legend: {
        itemStyle: { color: cssVar('--text-secondary'), fontWeight: '600', fontSize: '12px' },
        itemHoverStyle: { color: cssVar('--primary') },
      },
      tooltip: {
        backgroundColor: cssVar('--surface'),
        borderColor: cssVar('--border'),
        borderRadius: 10,
        shadow: true,
        style: { color: cssVar('--text-secondary'), fontSize: '12px' },
      },
      xAxis: {
        labels: { style: { color: cssVar('--text-muted'), fontSize: '11px' } },
        lineColor: cssVar('--border'),
        tickColor: cssVar('--border'),
        gridLineColor: 'transparent',
      },
      yAxis: {
        labels: { style: { color: cssVar('--text-muted'), fontSize: '11px' } },
        gridLineColor: cssVar('--border'),
        title: { text: null as any },
      },
    };
  }

  // ── 1. Page Views + Sessions — areaspline ─────────────────────
  private _buildPageViewsChart(data: AnalyticsDashboard): void {
    const primary = cssVar('--primary', '#4361ee');
    const accent = cssVar('--accent', '#7b61ff');
    const labels = data.pageViews.map(pv => this._fmtChartDate(pv.date));

    const options: Highcharts.Options = {
      ...this._hcBase(),
      chart: {
        ...(this._hcBase().chart as Highcharts.ChartOptions),
        type: 'areaspline',
        // Let Highcharts fill the container height set by CSS
        height: '100%',
      },
      xAxis: { ...this._hcBase().xAxis, categories: labels },
      tooltip: { ...this._hcBase().tooltip, shared: true },
      plotOptions: {
        areaspline: {
          fillOpacity: 0.15,
          marker: { enabled: false, symbol: 'circle', radius: 4 },
          lineWidth: 2.5,
        },
      },
      series: [
        {
          type: 'areaspline',
          name: 'Page Views',
          data: data.pageViews.map(pv => pv.pageViews),
          color: primary,
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [[0, cssVarAlpha('--primary', 0.25)], [1, cssVarAlpha('--primary', 0)]],
          },
        },
        {
          type: 'areaspline',
          name: 'Sessions',
          data: data.pageViews.map(pv => pv.sessions),
          color: accent,
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [[0, cssVarAlpha('--accent', 0.2)], [1, cssVarAlpha('--accent', 0)]],
          },
        },
      ],
    };
    this.pageViewsOptions.set(options);
  }

  // ── 2. Devices — donut / pie ──────────────────────────────────
  private _buildDevicesChart(data: AnalyticsDashboard): void {
    const primary = cssVar('--primary');
    const accent = cssVar('--accent');
    const border = cssVar('--surface');

    const deviceMap = new Map<string, number>();
    data.devices.forEach(d =>
      deviceMap.set(d.device, (deviceMap.get(d.device) ?? 0) + d.users)
    );

    const seriesData: Highcharts.PointOptionsObject[] = Array.from(deviceMap).map(
      ([name, y], i) => ({
        name, y,
        color: i === 0 ? primary : i === 1 ? accent : cssVarAlpha('--primary', 0.4),
      })
    );

    const options: Highcharts.Options = {
      ...this._hcBase(),
      chart: {
        ...(this._hcBase().chart as Highcharts.ChartOptions),
        type: 'pie',
        // FIX: explicit pixel height prevents the pie clipping at 50%.
        // Do NOT use '100%' for pie — Highcharts needs a concrete value
        // to correctly allocate space for the plot area + legend.
        height: 320,
        marginTop: 10,
      },
      tooltip: {
        ...this._hcBase().tooltip,
        pointFormat: '<b>{point.name}</b>: {point.percentage:.1f}% ({point.y:,.0f} users)',
      },
      plotOptions: {
        pie: {
          innerSize: '56%',
          borderColor: border,
          borderWidth: 3,
          center: ['50%', '45%'],  // shift centre up so legend fits below
          size: '75%',           // leave room for legend without clipping
          dataLabels: {
            enabled: true,
            format: '<b>{point.name}</b>: {point.percentage:.1f}%',
            style: { fontSize: '11px', color: cssVar('--text-secondary'), fontWeight: '600' },
            connectorColor: cssVar('--border'),
          },
          showInLegend: true,
        },
      },
      legend: {
        ...this._hcBase().legend,
        enabled: true,
        align: 'center',
        layout: 'horizontal',
        verticalAlign: 'bottom',
      },
      series: [{ type: 'pie', name: 'Users', data: seriesData }],
    };
    this.devicesOptions.set(options);
  }

  // ── 3. Traffic sources — column ───────────────────────────────
  private _buildTrafficChart(data: AnalyticsDashboard): void {
    const options: Highcharts.Options = {
      ...this._hcBase(),
      chart: {
        ...(this._hcBase().chart as Highcharts.ChartOptions),
        type: 'column',
        height: '100%',
      },
      xAxis: { ...this._hcBase().xAxis, categories: data.traffic.map(t => t.source) },
      tooltip: { ...this._hcBase().tooltip, pointFormat: '<b>{point.y:,.0f}</b> sessions' },
      plotOptions: {
        column: {
          borderRadius: 6,
          colorByPoint: true,
          colors: data.traffic.map((_, i) => {
            const alpha = 1 - i * (0.5 / Math.max(data.traffic.length - 1, 1));
            return cssVarAlpha('--primary', Math.max(alpha, 0.3));
          }),
          dataLabels: {
            enabled: true,
            format: '{point.y:,.0f}',
            style: { fontSize: '11px', fontWeight: '600', color: cssVar('--text-secondary') },
          },
        },
      },
      legend: { enabled: false },
      series: [{ type: 'column', name: 'Sessions', data: data.traffic.map(t => t.sessions) }],
    };
    this.trafficOptions.set(options);
  }

  // ── 4. Geographic — horizontal bar ───────────────────────────
  private _buildGeoChart(data: AnalyticsDashboard): void {
    const top10 = data.geographic.slice(0, 10);
    const options: Highcharts.Options = {
      ...this._hcBase(),
      chart: {
        ...(this._hcBase().chart as Highcharts.ChartOptions),
        type: 'bar',
        height: '100%',
      },
      xAxis: { ...this._hcBase().xAxis, categories: top10.map(g => g.country), title: { text: null as any } },
      yAxis: { ...this._hcBase().yAxis, title: { text: null as any } },
      tooltip: { ...this._hcBase().tooltip, pointFormat: '<b>{point.y:,.0f}</b> users' },
      plotOptions: {
        bar: {
          borderRadius: 5,
          dataLabels: {
            enabled: true,
            format: '{point.y:,.0f}',
            style: { fontSize: '11px', fontWeight: '600', color: cssVar('--text-secondary') },
          },
          colorByPoint: true,
          colors: top10.map((_, i) => {
            const alpha = 1 - i * (0.55 / Math.max(top10.length - 1, 1));
            return cssVarAlpha('--accent', Math.max(alpha, 0.25));
          }),
        },
      },
      legend: { enabled: false },
      series: [{ type: 'bar', name: 'Users', data: top10.map(g => g.users) }],
    };
    this.geoOptions.set(options);
  }

  private _buildAllCharts(data: AnalyticsDashboard): void {
    this._buildPageViewsChart(data);
    this._buildDevicesChart(data);
    this._buildTrafficChart(data);
    this._buildGeoChart(data);
    this.updateFlag.set(true);
  }

  // ── Date helpers ──────────────────────────────────────────────
  private _fmtChartDate(d: string): string {
    const dt = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private _fmtDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}