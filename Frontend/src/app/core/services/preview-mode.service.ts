import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

const STORAGE_KEY = 'rn-preview-public';

/**
 * "View public site" preview.
 *
 * An admin stays authenticated, but this flag lets the shell render exactly as a
 * guest visitor sees it (top navbar, no admin sidebar / notifications / profile
 * admin UI) — so the admin can preview the public experience without logging out.
 *
 * Entered via the topbar/overview "View public site" links (`?view=public`, opened
 * in a new tab). Persisted in sessionStorage so it survives in-tab navigation
 * across the public pages; cleared on Exit.
 *
 * NOTE: this is a *visual/layout* preview — the session is still an admin session,
 * so admin-only data still loads and the AI chat still uses the admin quota. For a
 * true guest experience (guest rate limits), use a private/incognito window.
 */
@Injectable({ providedIn: 'root' })
export class PreviewModeService {
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(this.platformId);

  /** True when the shell should render as the public/visitor site despite an admin session. */
  readonly previewPublic = signal(false);

  constructor() {
    if (this.isBrowser && sessionStorage.getItem(STORAGE_KEY) === '1') {
      this.previewPublic.set(true);
    }
  }

  /** Turn preview on (called when the `?view=public` param is detected). */
  enable(): void {
    if (this.isBrowser) sessionStorage.setItem(STORAGE_KEY, '1');
    this.previewPublic.set(true);
  }

  /** Leave preview and return to the admin dashboard. */
  exit(): void {
    if (this.isBrowser) sessionStorage.removeItem(STORAGE_KEY);
    this.previewPublic.set(false);
    this.router.navigate(['/admin']);
  }
}
