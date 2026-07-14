import { Injectable, signal, effect, computed, inject } from "@angular/core";
import { AppService } from "../services/app.service";
import { LocalStorageService } from "src/app/shared/services/local-storage.service";
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ThemeDefinition {
  id: string;
  name: string;
  tokens: Record<string, string>;
  dark_tokens: Record<string, string>;
}

// ── Built-in themes ──────────────────────────────────────────────────────────
// These register immediately on app boot so the page has correct colors
// before the profile API responds. ThemeService merges user-created themes
// from the profile on top of these — user themes always win on conflict.
const BUILT_IN_THEMES: ThemeDefinition[] = [
  {
    id: 'basic',
    name: 'Emerald',
    tokens: {
      background:          '#F8FAFC',
      surface:             '#FFFFFF',
      'surface-alt':       '#F1F5F9',
      primary:             '#10B981',
      accent:              '#06B6D4',
      highlight:           '#6366F1',
      'primary-glow':      'rgba(16, 185, 129, 0.18)',
      'text-primary':      '#0F172A',
      'text-secondary':    '#475569',
      'text-muted':        '#94A3B8',
      border:              '#E2E8F0',
      success:             '#10B981',
      warning:             '#F59E0B',
      error:               '#EF4444',
      'logo-primary':      '#10B981',
      'logo-secondary':    '#06B6D4',
      'logo-border':       '#D1FAE5',
      'logo-border-hover': '#A7F3D0',
      'logo-shadow':       'rgba(16, 185, 129, 0.22)',
    },
    dark_tokens: {
      background:          '#020617',
      surface:             '#0F172A',
      'surface-alt':       '#1E293B',
      primary:             '#10B981',
      accent:              '#06B6D4',
      highlight:           '#818CF8',
      'primary-glow':      'rgba(16, 185, 129, 0.28)',
      'text-primary':      '#F1F5F9',
      'text-secondary':    '#94A3B8',
      'text-muted':        '#64748B',
      border:              '#1E293B',
      success:             '#10B981',
      warning:             '#F59E0B',
      error:               '#EF4444',
      'logo-primary':      '#10B981',
      'logo-secondary':    '#06B6D4',
      'logo-border':       'rgba(16, 185, 129, 0.24)',
      'logo-border-hover': 'rgba(16, 185, 129, 0.40)',
      'logo-shadow':       'rgba(25, 40, 80, 0.50)',
    },
  },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly THEME_KEY = 'selected-theme-id';
  private readonly DARK_KEY = 'is-dark-mode';
  private platformId = inject(PLATFORM_ID);
  appService = inject(AppService);
  localStorageService = inject(LocalStorageService);
  profileSignal = this.appService.profile;
  // Signals for reactive UI
  currentThemeId = signal<string>(this.localStorageService.getItem(this.THEME_KEY) || 'basic');
  isDark = signal<boolean>(this.localStorageService.getItem(this.DARK_KEY) === 'true');

  // Registry to hold theme data
  private themeRegistry = new Map<string, ThemeDefinition>();

  constructor() {
    // Register built-in themes immediately so the page has correct colors
    // before the profile API responds.
    this.registerThemes(BUILT_IN_THEMES);

    // Automatically re-apply theme tokens whenever the ID or Dark Mode changes
    effect(() => {
      this.applyTheme(this.currentThemeId(), this.isDark());
    });
  }

  /** Reset theme to defaults + clear persistence — call on login/logout so one
   *  user's theme never carries into another's session. */
  reset(): void {
    this.localStorageService.removeItem(this.THEME_KEY);
    this.localStorageService.removeItem(this.DARK_KEY);
    this.isDark.set(false);
    this.currentThemeId.set('basic');
  }

  // A computed signal that returns the full object of the active theme
  activeTheme = computed(() => {
    return this.themeRegistry.get(this.currentThemeId());
  });

  // A helper to check if the active theme is festive
  isChristmasTheme = computed(() => {
    const theme = this.activeTheme();
    if (!theme) return false;

    // Check if ID OR the display Name contains "christmas"
    const searchStr = 'christmas';
    return theme.id.toLowerCase().includes(searchStr) ||
      theme.name.toLowerCase().includes(searchStr);
  });

  isNewYearTheme = computed(() => {
    const theme = this.activeTheme();
    if (!theme) return false;

    // Check if ID OR the display Name contains "new year" or "celebration"
    const searchStrs = ['new year', 'celebration'];
    return searchStrs.some(str =>
      theme.id.toLowerCase().includes(str) ||
      theme.name.toLowerCase().includes(str)
    );
  });

  // Register themes coming from API or Static files
  registerThemes(themes: ThemeDefinition[]) {
    themes.forEach(t => this.themeRegistry.set(t.id, t));
    // Re-apply in case the current theme data was just loaded
    this.applyTheme(this.currentThemeId(), this.isDark());
  }

  setTheme(themeId: string) {
    this.localStorageService.setItem(this.THEME_KEY, themeId);
    this.currentThemeId.set(themeId);
  }

  toggleDarkMode() {
    const newValue = !this.isDark();
    this.localStorageService.setItem(this.DARK_KEY, String(newValue));
    this.isDark.set(newValue);
  }

  private applyTheme(id: string, dark: boolean) {
    if (!isPlatformBrowser(this.platformId)) return;

    const theme = this.themeRegistry.get(id);
    if (!theme) return;

    // Fall back to light tokens when dark_tokens aren't defined for this theme
    const tokens = (dark && theme.dark_tokens && Object.keys(theme.dark_tokens).length > 0)
      ? theme.dark_tokens
      : theme.tokens;

    if (!tokens || Object.keys(tokens).length === 0) return;

    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(`--${key.replace(/_/g, '-')}`, value);
    });
  }
}
