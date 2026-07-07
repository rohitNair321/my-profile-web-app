import { ChangeDetectionStrategy, Component, computed, Injector, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonApp } from 'src/app/core/services/common';

// ── Token structure that matches ThemeService / settings builder ──────────────
interface TokenSet {
  primary:        string;
  accent:         string;
  success:        string;
  warning:        string;
  error:          string;
  background:     string;
  surface:        string;
  surface_alt:    string;
  border:         string;
  text_primary:   string;
  text_secondary: string;
  text_muted:     string;
  primary_glow:   string;
}

interface AppTheme {
  id:          string;
  name:        string;
  active:      boolean;
  c1:          string;   // primary (for card preview)
  c2:          string;   // accent
  c3:          string;   // background
  tokens:      Partial<TokenSet>;
  dark_tokens: Partial<TokenSet>;
}

const LIGHT_DEFAULTS: TokenSet = {
  primary:        '#10B981',
  accent:         '#06B6D4',
  success:        '#10B981',
  warning:        '#F59E0B',
  error:          '#EF4444',
  background:     '#F8FAFC',
  surface:        '#FFFFFF',
  surface_alt:    '#F1F5F9',
  border:         '#E2E8F0',
  text_primary:   '#0F172A',
  text_secondary: '#475569',
  text_muted:     '#94A3B8',
  primary_glow:   'rgba(16,185,129,0.18)',
};

const DARK_DEFAULTS: TokenSet = {
  primary:        '#10B981',
  accent:         '#06B6D4',
  success:        '#10B981',
  warning:        '#F59E0B',
  error:          '#EF4444',
  background:     '#020617',
  surface:        '#0F172A',
  surface_alt:    '#1E293B',
  border:         '#1E293B',
  text_primary:   '#F1F5F9',
  text_secondary: '#94A3B8',
  text_muted:     '#64748B',
  primary_glow:   'rgba(16,185,129,0.28)',
};

/** Normalise keys like 'text-primary' → 'text_primary' so we can use them in both directions */
function normaliseTokens(raw: Record<string, string> = {}): Partial<TokenSet> {
  const out: any = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k.replace(/-/g, '_')] = v;
  }
  return out;
}

@Component({
  selector: 'app-admin-themes',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './themes.component.html',
  styleUrls: ['./themes.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminThemesComponent extends CommonApp {
  showBuilder  = signal(false);
  editingTheme = signal<AppTheme | null>(null);
  saving       = signal(false);
  builderMode  = signal<'light' | 'dark'>('light');

  // Full token objects for the builder form
  bName  = '';
  bLight: TokenSet = { ...LIGHT_DEFAULTS };
  bDark:  TokenSet = { ...DARK_DEFAULTS };

  themes = computed<AppTheme[]>(() => {
    const p       = this.appService.profile();
    const current = p?.currenttheme ?? '';
    return (p?.themes ?? []).map((t: any) => {
      const lt = normaliseTokens(t.tokens ?? {});
      const dt = normaliseTokens(t.dark_tokens ?? {});
      return {
        id:          t.id   ?? t.name,
        name:        t.name ?? t.id,
        active:      (t.name ?? t.id) === current,
        c1:          lt.primary    ?? '#10B981',
        c2:          lt.accent     ?? '#06B6D4',
        c3:          lt.background ?? '#0F172A',
        tokens:      lt,
        dark_tokens: dt,
      };
    });
  });

  constructor(public override injector: Injector) {
    super(injector);
  }

  // ── Card actions ───────────────────────────────────────────────────────────

  activateTheme(id: string): void {
    const theme = this.themes().find(t => t.id === id);
    if (!theme) return;
    const fd = new FormData();
    fd.append('currenttheme', theme.name);
    this.saveWithFeedback(this.appService.updateProfile(fd), 'Theme activated').subscribe();
  }

  deleteTheme(id: string): void {
    const existing: any[] = this.appService.profile()?.themes ?? [];
    const theme = this.themes().find(t => t.id === id);
    if (theme?.active) return;
    const updated = existing.filter((t: any) => (t.id ?? t.name) !== id);
    const fd = new FormData();
    fd.append('themes', JSON.stringify(updated));
    this.saveWithFeedback(this.appService.updateProfile(fd), 'Theme deleted').subscribe();
  }

  // ── Builder dialog ─────────────────────────────────────────────────────────

  openNew(): void {
    this.editingTheme.set(null);
    this.bName  = '';
    this.bLight = { ...LIGHT_DEFAULTS };
    this.bDark  = { ...DARK_DEFAULTS };
    this.builderMode.set('light');
    this.showBuilder.set(true);
  }

  openEdit(t: AppTheme): void {
    this.editingTheme.set(t);
    this.bName  = t.name;
    this.bLight = { ...LIGHT_DEFAULTS, ...t.tokens };
    this.bDark  = { ...DARK_DEFAULTS,  ...t.dark_tokens };
    this.builderMode.set('light');
    this.showBuilder.set(true);
  }

  saveBuilder(): void {
    if (!this.bName.trim()) return;
    const existing: any[] = this.appService.profile()?.themes ?? [];
    const editing = this.editingTheme();

    const newTheme = {
      id:          editing?.id ?? `theme-${Date.now()}`,
      name:        this.bName.trim(),
      tokens:      { ...this.bLight },
      dark_tokens: { ...this.bDark },
    };

    const updatedThemes = editing
      ? existing.map((t: any) => (t.id === editing.id || t.name === editing.name) ? newTheme : t)
      : [...existing, newTheme];

    this.saving.set(true);
    const fd = new FormData();
    fd.append('themes', JSON.stringify(updatedThemes));
    this.saveWithFeedback(this.appService.updateProfile(fd), 'Theme saved').subscribe({
      next: () => this.saving.set(false),
      error: () => this.saving.set(false),
    });
    this.showBuilder.set(false);
  }
}
