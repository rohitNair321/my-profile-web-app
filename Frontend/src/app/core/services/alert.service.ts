import { Injectable, computed, signal } from '@angular/core';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'custom';

export interface AlertAction {
  label: string;
  /** Runs when the button is clicked; the alert dismisses itself afterwards */
  handler: () => void;
}

export interface AlertOptions {
  /** Optional bold heading above the message */
  title?: string;
  /** Auto-dismiss after N ms. 0 = sticky (stays until dismissed). Default 5000. */
  duration?: number;
  /** Material icon override (defaults per type) */
  icon?: string;
  /** Optional call-to-action button */
  action?: AlertAction;
}

export interface Alert extends AlertOptions {
  id: string;
  message: string;
  type: AlertType;
  duration: number;
}

const DEFAULT_DURATION = 5000;

@Injectable({ providedIn: 'root' })
export class AlertService {
  // Primary queue — supports stacked alerts
  readonly alerts = signal<Alert[]>([]);

  // Legacy computed signals — derived from queue for backward compat
  readonly isOpen  = computed(() => this.alerts().length > 0);
  readonly message = computed(() => this.alerts()[0]?.message ?? '');
  readonly type    = computed<AlertType>(() => this.alerts()[0]?.type ?? 'info');

  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Show an alert. Backward compatible with showAlert(message, type);
   * pass options for title / sticky / custom icon / action button.
   */
  showAlert(message: string, type: AlertType = 'info', options: AlertOptions = {}): string {
    const id = Math.random().toString(36).slice(2, 9);
    const duration = options.duration ?? DEFAULT_DURATION;

    this.alerts.update(q => [...q, { id, message, type, ...options, duration }]);

    if (duration > 0) {
      this.timers.set(id, setTimeout(() => this.dismiss(id), duration));
    }
    return id;
  }

  // ── Convenience shorthands ─────────────────────────────────────
  success(message: string, options?: AlertOptions): string { return this.showAlert(message, 'success', options); }
  error(message: string, options?: AlertOptions): string   { return this.showAlert(message, 'error',   options); }
  warning(message: string, options?: AlertOptions): string { return this.showAlert(message, 'warning', options); }
  info(message: string, options?: AlertOptions): string    { return this.showAlert(message, 'info',    options); }

  /** Fully custom alert — pick your own icon, duration, action */
  custom(message: string, options: AlertOptions = {}): string {
    return this.showAlert(message, 'custom', options);
  }

  runAction(id: string): void {
    const alert = this.alerts().find(a => a.id === id);
    try { alert?.action?.handler(); } finally { this.dismiss(id); }
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) { clearTimeout(timer); this.timers.delete(id); }
    this.alerts.update(q => q.filter(a => a.id !== id));
  }

  close(): void {
    const first = this.alerts()[0];
    if (first) this.dismiss(first.id);
  }

  clearAll(): void {
    for (const a of this.alerts()) {
      const t = this.timers.get(a.id);
      if (t) clearTimeout(t);
    }
    this.timers.clear();
    this.alerts.set([]);
  }
}
