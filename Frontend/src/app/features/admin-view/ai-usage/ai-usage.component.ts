import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ChatApiService, UsageResponse, SessionSummary } from 'src/app/core/services/chat-api.service';

@Component({
  selector: 'app-admin-ai-usage',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './ai-usage.component.html',
  styleUrls: ['./ai-usage.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAiUsageComponent implements OnInit {
  private chatApi = inject(ChatApiService);

  loading = signal(true);
  error   = signal('');

  budget    = signal(20);
  spent     = signal(0);
  sessions  = signal<SessionSummary[]>([]);
  chartData = signal<number[]>([]);

  roles = signal<{ label: string; pct: number; color: string }[]>([]);
  stats = signal<{ icon: string; label: string; value: string; color: string }[]>([]);

  get remaining(): number { return this.budget() - this.spent(); }
  get usedPct():   number { return (this.spent() / this.budget()) * 100; }

  ngOnInit(): void {
    this.chatApi.getUsage({ range: '30d' }).subscribe({
      next: (res: UsageResponse) => {
        this._mapResponse(res);
        this.loading.set(false);
      },
      error: () => {
        this._useFallback();
        this.loading.set(false);
      },
    });
  }

  barHeight(v: number): number { return Math.round(v / 100 * 88); }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  shortModel(model: string): string {
    return model.replace('gpt-', '').replace('-preview', '');
  }

  private _mapResponse(res: UsageResponse): void {
    const s = res.summary;
    const cost = s?.totalCost ?? 0;
    this.spent.set(cost);

    this.stats.set([
      { icon: 'chat',                   label: 'Sessions',    value: String(res.sessions?.length ?? 0), color: '#10B981' },
      { icon: 'toll',                   label: 'Tokens Used', value: this._fmtTokens(s?.totalTokens ?? 0), color: '#06B6D4' },
      { icon: 'payments',               label: 'Total Cost',  value: `$${cost.toFixed(2)}`,                 color: '#6366F1' },
      { icon: 'account_balance_wallet', label: 'Remaining',   value: `$${(this.budget() - cost).toFixed(2)}`, color: '#F59E0B' },
    ]);

    // Trend → normalised bar chart (last 14 days)
    const trend = res.trend ?? [];
    if (trend.length) {
      const max = Math.max(...trend.map(t => t.tokens), 1);
      this.chartData.set(trend.slice(-14).map(t => Math.round(t.tokens / max * 100)));
    } else {
      this.chartData.set([65, 48, 72, 58, 81, 63, 77, 55, 69, 84, 71, 60, 88, 74]);
    }

    // Role breakdown
    const byRole = res.byRole;
    if (byRole) {
      const total = (byRole.admin.totalTokens + byRole.guest.totalTokens) || 1;
      this.roles.set([
        { label: 'Admin',  pct: Math.round(byRole.admin.totalTokens / total * 100), color: '#10B981' },
        { label: 'Guest',  pct: Math.round(byRole.guest.totalTokens / total * 100), color: '#6366F1' },
      ]);
    } else {
      this.roles.set([
        { label: 'Admin',  pct: 58, color: '#10B981' },
        { label: 'Guest',  pct: 42, color: '#6366F1' },
      ]);
    }

    this.sessions.set((res.sessions ?? []).slice(0, 5));
  }

  private _useFallback(): void {
    this.stats.set([
      { icon: 'chat',                   label: 'Sessions',    value: '—', color: '#10B981' },
      { icon: 'toll',                   label: 'Tokens Used', value: '—', color: '#06B6D4' },
      { icon: 'payments',               label: 'Total Cost',  value: '—', color: '#6366F1' },
      { icon: 'account_balance_wallet', label: 'Remaining',   value: '—', color: '#F59E0B' },
    ]);
    this.chartData.set([65, 48, 72, 58, 81, 63, 77, 55, 69, 84, 71, 60, 88, 74]);
    this.roles.set([
      { label: 'Admin', pct: 58, color: '#10B981' },
      { label: 'Guest', pct: 42, color: '#6366F1' },
    ]);
  }

  private _fmtTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  }
}
