import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import * as Highcharts from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';
import { TableModule }    from 'primeng/table';
import { TagModule }      from 'primeng/tag';
import { TooltipModule }  from 'primeng/tooltip';
import { ChatApiService } from 'src/app/core/services/chat-api.service';

// ── CSS token helpers ─────────────────────────────────────────
function cssVar(name: string, fallback = '#888'): string {
  if (typeof document === 'undefined') { return fallback; }
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim() || fallback;
}

function cssVarAlpha(name: string, alpha: number, fallback = '#888'): string {
  const hex = cssVar(name, fallback).replace('#', '');
  const r   = parseInt(hex.slice(0, 2), 16);
  const g   = parseInt(hex.slice(2, 4), 16);
  const b   = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some(isNaN)) { return fallback; }
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Types ─────────────────────────────────────────────────────
interface UsageSummary   { totalTokens: number; inputTokens: number; outputTokens: number; totalCost: number; }
interface UsageTrend     { date: string; tokens: number; inputTokens: number; outputTokens: number; cost: number; requests: number; }
interface ModelBreakdown { model: string; totalTokens: number; inputTokens: number; outputTokens: number; cost: number; requests: number; }
interface RoleBlock      { totalTokens: number; inputTokens: number; outputTokens: number; cost: number; requests: number; }
interface SessionSummary { sessionId: string; date: string; totalTokens: number; inputTokens: number; outputTokens: number; cost: number; requests: number; model: string; }
interface AllTimeBlock   { totalTokens: number; inputTokens: number; outputTokens: number; totalRequests: number; totalCost: number; }
interface UsageResponse  { summary: UsageSummary; trend: UsageTrend[]; byModel: ModelBreakdown[]; byRole: { admin: RoleBlock; guest: RoleBlock }; sessions: SessionSummary[]; allTime: AllTimeBlock; }
interface BalanceResponse{ source: 'openai'|'supabase'; totalUsedUSD: number; hardLimitUSD: number|null; remainingUSD: number|null; remainingPct: number|null; }

// ── Pricing per 1K tokens ─────────────────────────────────────
const PRICING: Record<string, { input: number; output: number }> = {
  'o4-mini':       { input: 0.003,   output: 0.012  },
  'gpt-4o':        { input: 0.005,   output: 0.015  },
  'gpt-4o-mini':   { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo':   { input: 0.01,    output: 0.03   },
  'gpt-3.5-turbo': { input: 0.0005,  output: 0.0015 },
};
const DEFAULT_RATE = { input: 0.003, output: 0.012 };
function getRate(model: string) { return PRICING[model] ?? DEFAULT_RATE; }

interface RangeOption { label: string; value: string; }
interface RateRow     { model: string; inputRate: string; outputRate: string; highlight: boolean; }
type Tab = 'overview' | 'history' | 'sessions';
interface TabOption { id: Tab; label: string; icon: string; }

@Component({
  selector:    'app-ai-usage-dashboard',
  standalone:  true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DecimalPipe,
    HighchartsChartComponent,
    TableModule,
    TagModule,
    TooltipModule,
  ],
  templateUrl: './ai-usage-dashboard.component.html',
  styleUrls:  ['./ai-usage-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiUsageDashboardComponent implements OnInit {

  // ── Highcharts ────────────────────────────────────────────────
  readonly Highcharts: typeof Highcharts = Highcharts;
  trendChartOptions = signal<Highcharts.Options | null>(null);
  updateFlag        = signal(false);

  // ── State ─────────────────────────────────────────────────────
  summary        = signal<UsageSummary | null>(null);
  trend          = signal<UsageTrend[]>([]);
  byModel        = signal<ModelBreakdown[]>([]);
  byRole         = signal<{ admin: RoleBlock; guest: RoleBlock } | null>(null);
  sessions       = signal<SessionSummary[]>([]);
  allTime        = signal<AllTimeBlock | null>(null);
  balance        = signal<BalanceResponse | null>(null);
  loading        = signal(false);
  balanceLoading = signal(false);
  hasError       = signal(false);
  selectedRange  = signal('7d');
  activeTab      = signal<Tab>('overview');

  // ── Static config ─────────────────────────────────────────────
  readonly ranges: RangeOption[] = [
    { label: '7D',  value: '7d'  },
    { label: '30D', value: '30d' },
    { label: '90D', value: '90d' },
    { label: 'All', value: 'all' },
  ];

  readonly tabs: TabOption[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'sessions', label: 'Sessions', icon: 'list_alt' },
  ];

  readonly rateCard: RateRow[] = [
    { model: 'o4-mini',       inputRate: '$0.003',   outputRate: '$0.012',  highlight: true  },
    { model: 'gpt-4o',        inputRate: '$0.005',   outputRate: '$0.015',  highlight: false },
    { model: 'gpt-4o-mini',   inputRate: '$0.00015', outputRate: '$0.0006', highlight: false },
    { model: 'gpt-4-turbo',   inputRate: '$0.010',   outputRate: '$0.030',  highlight: false },
    { model: 'gpt-3.5-turbo', inputRate: '$0.0005',  outputRate: '$0.0015', highlight: false },
  ];

  // ── Computed ──────────────────────────────────────────────────
  inputPct = computed<number>(() => {
    const s = this.summary();
    if (!s || s.totalTokens === 0) { return 0; }
    return Math.round((s.inputTokens / s.totalTokens) * 100);
  });

  outputPct = computed<number>(() => {
    const s = this.summary();
    if (!s || s.totalTokens === 0) { return 0; }
    return Math.round((s.outputTokens / s.totalTokens) * 100);
  });

  efficiencyRatio = computed<number>(() => {
    const s = this.summary();
    if (!s || s.inputTokens === 0) { return 0; }
    return s.outputTokens / s.inputTokens;
  });

  totalCost  = computed<number>(() => this.summary()?.totalCost ?? 0);

  inputCost = computed<number>(() => {
    const s = this.summary();
    if (!s) { return 0; }
    const rate = getRate(this.byModel()[0]?.model ?? 'o4-mini');
    return (s.inputTokens / 1000) * rate.input;
  });

  outputCost = computed<number>(() => {
    const s = this.summary();
    if (!s) { return 0; }
    const rate = getRate(this.byModel()[0]?.model ?? 'o4-mini');
    return (s.outputTokens / 1000) * rate.output;
  });

  topModel = computed<ModelBreakdown | null>(() => this.byModel()[0] ?? null);

  guestTokenPct = computed<number>(() => {
    const r = this.byRole();
    if (!r) { return 0; }
    const total = r.admin.totalTokens + r.guest.totalTokens;
    return total ? Math.round((r.guest.totalTokens / total) * 100) : 0;
  });

  adminTokenPct = computed<number>(() => 100 - this.guestTokenPct());

  allTimeCostFormatted = computed<string>(() => {
    const a = this.allTime();
    return a ? `$${a.totalCost.toFixed(4)}` : '$0.0000';
  });

  rankedSessions = computed(() =>
    this.sessions().map((s, i) => ({ ...s, rank: i + 1 }))
  );

  // ── Highcharts shared base ────────────────────────────────────
  private _hcBase(): Partial<Highcharts.Options> {
    return {
      chart: {
        backgroundColor: 'transparent',
        style:           { fontFamily: 'inherit' },
        animation:       { duration: 500 },
        reflow:          true,
      } as Highcharts.ChartOptions,
      credits:   { enabled: false },
      exporting: { enabled: false },
      title:     { text: undefined },
      legend: {
        itemStyle: { color: cssVar('--text-secondary'), fontWeight: '600', fontSize: '11px' },
      },
      tooltip: {
        backgroundColor: cssVar('--surface'),
        borderColor:     cssVar('--border'),
        borderRadius:    10,
        style:           { color: cssVar('--text-secondary'), fontSize: '12px' },
      },
      xAxis: {
        labels:        { style: { color: cssVar('--text-muted'), fontSize: '11px' } },
        lineColor:     cssVar('--border'),
        tickColor:     cssVar('--border'),
        gridLineColor: 'transparent',
      },
      yAxis: {
        labels:        { style: { color: cssVar('--text-muted'), fontSize: '11px' } },
        gridLineColor: cssVar('--border'),
        title:         { text: null as any },
      },
    };
  }

  // ── Trend chart — column + spline dual-axis ───────────────────
  private _buildTrendChart(): void {
    const data    = this.trend();
    if (!data.length) { this.trendChartOptions.set(null); return; }

    const primary = cssVar('--primary');
    const accent  = cssVar('--accent');
    const labels  = data.map(d => this.formatDate(d.date));

    const options: Highcharts.Options = {
      ...this._hcBase(),
      chart: {
        ...(this._hcBase().chart as Highcharts.ChartOptions),
        type:   'column',
        // Use a fixed pixel height so the chart fully renders in
        // all screen sizes without needing the parent to have height.
        height: 220,
      },
      xAxis: { ...this._hcBase().xAxis, categories: labels },
      tooltip: {
        ...this._hcBase().tooltip,
        shared:  true,
        useHTML: true,
        // FIX: Use `function(this: any)` — Highcharts.TooltipFormatterContextObject
        // is NOT exported by the highcharts package in v10+.
        // The correct approach is to type `this` as `any` or use the
        // pointFormat string syntax instead of a formatter function.
        formatter(this: any): string {
          const pts: any[] = this.points ?? [];
          return `<b>${this.x}</b><br>` +
            pts.map((p: any) =>
              `${p.series.name}: <b>${(p.y ?? 0).toLocaleString()}</b>`
            ).join('<br>');
        },
      },
      plotOptions: {
        column: { borderRadius: 5, grouping: true },
        spline: { lineWidth: 2.5, marker: { enabled: false } },
      },
      yAxis: [
        {
          ...(this._hcBase().yAxis as Highcharts.YAxisOptions),
          title: { text: 'Tokens', style: { color: cssVar('--text-muted'), fontSize: '10px' } } as any,
        },
        {
          title:         { text: 'Cost ($)', style: { color: cssVar('--text-muted'), fontSize: '10px' } } as any,
          labels:        { format: '${value:.4f}', style: { color: cssVar('--text-muted'), fontSize: '10px' } },
          opposite:      true,
          gridLineWidth: 0,
        },
      ],
      series: [
        {
          type:  'column',
          name:  'Tokens',
          data:  data.map(d => d.tokens),
          color: cssVarAlpha('--primary', 0.75),
          yAxis: 0,
        },
        {
          type:  'spline',
          name:  'Cost (USD)',
          data:  data.map(d => parseFloat(d.cost.toFixed(5))),
          color: accent,
          yAxis: 1,
          tooltip: { valuePrefix: '$', valueDecimals: 5 },
        },
      ],
      legend: { ...this._hcBase().legend, enabled: true },
    };

    this.trendChartOptions.set(options);
    this.updateFlag.set(true);
  }

  // ── Template helpers ──────────────────────────────────────────
  formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatDateLong(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  shortId(id: string): string {
    return id.length > 12 ? id.slice(0, 6) + '…' + id.slice(-4) : id;
  }

  efficiencyLabel(ratio: number): string {
    return ratio < 0.1 ? 'very concise' : ratio < 0.3 ? 'balanced' : 'verbose';
  }

  onChartUpdateChange(next: boolean): void { this.updateFlag.set(next); }

  // ── Lifecycle ─────────────────────────────────────────────────
  constructor(private api: ChatApiService) {
    effect(() => {
      if (this.trend().length) { this._buildTrendChart(); }
    });
  }

  ngOnInit(): void {
    this.loadUsage();
    this.loadBalance();
  }

  loadUsage(): void {
    this.loading.set(true);
    this.hasError.set(false);

    this.api.getUsage({ range: this.selectedRange() }).subscribe({
      next: (res: UsageResponse) => {
        this.summary.set(res.summary);
        this.trend.set(res.trend     ?? []);
        this.byModel.set(res.byModel   ?? []);
        this.byRole.set(res.byRole     ?? null);
        this.sessions.set(res.sessions ?? []);
        this.allTime.set(res.allTime   ?? null);
        this.loading.set(false);
      },
      error: () => { this.hasError.set(true); this.loading.set(false); },
    });
  }

  loadBalance(): void {
    this.balanceLoading.set(true);
    (this.api as any).getBalance?.()?.subscribe({
      next: (res: BalanceResponse) => { this.balance.set(res); this.balanceLoading.set(false); },
      error: () => this.balanceLoading.set(false),
    });
  }

  changeRange(range: string): void { this.selectedRange.set(range); this.loadUsage(); }
  setTab(tab: Tab): void           { this.activeTab.set(tab); }
}