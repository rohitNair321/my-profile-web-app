import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from 'src/environments/environments';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {

  // ── Holds events fired before gtag.js finishes loading ──────────────────
  private eventQueue: Array<{ name: string; params?: any }> = [];
  private isLoaded = false;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private get windowRef(): any | undefined {
    return this.isBrowser ? window : undefined;
  }

  private get documentRef(): Document | undefined {
    return this.isBrowser ? document : undefined;
  }

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (this.isBrowser) {
      this.loadAnalytics();
    }
  }

  // ── Dynamically injects gtag.js and flushes the queue on load ───────────
  private loadAnalytics(): void {
    if (!this.isBrowser || !environment.gaTrackingId) return;

    const doc = this.documentRef;
    if (!doc) return;

    // Inline bootstrap — must run BEFORE the async script loads
    const inlineScript = doc.createElement('script');
    inlineScript.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){ dataLayer.push(arguments); }
      gtag('js', new Date());
      gtag('config', '${environment.gaTrackingId}', { send_page_view: false });
    `;
    doc.head.appendChild(inlineScript);

    // Async gtag.js loader — flush queued events once ready
    const script = doc.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${environment.gaTrackingId}`;

    script.onload = () => {
      this.isLoaded = true;
      this.flushQueue();   // send any events that fired before script loaded
    };

    script.onerror = () => {
      // GA blocked (ad blocker etc.) — clear queue silently, never throw
      this.eventQueue = [];
    };

    doc.head.appendChild(script);
  }

  // ── Public: call this for any GA event including page_view ──────────────
  trackEvent(eventName: string, params?: Record<string, any>): void {
    if (!this.isBrowser) return;  // SSR guard

    const win = this.windowRef;
    if (!win) return;

    if (this.isLoaded && win.gtag) {
      win.gtag('event', eventName, params);
    } else {
      // gtag not ready yet — queue it and send once loaded
      this.eventQueue.push({ name: eventName, params });
    }
  }

  // ── Drains the queue after gtag.js finishes loading ─────────────────────
  private flushQueue(): void {
    const win = this.windowRef;
    if (!win || !win.gtag) {
      this.eventQueue = [];
      return;
    }

    this.eventQueue.forEach(e => {
      win.gtag('event', e.name, e.params);
    });
    this.eventQueue = [];
  }
}