import { Injectable, computed, signal } from '@angular/core';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface Alert {
  id: string;
  message: string;
  type: AlertType;
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  // Primary queue — supports stacked alerts
  readonly alerts = signal<Alert[]>([]);

  // Legacy computed signals — derived from queue for backward compat
  readonly isOpen  = computed(() => this.alerts().length > 0);
  readonly message = computed(() => this.alerts()[0]?.message ?? '');
  readonly type    = computed<AlertType>(() => this.alerts()[0]?.type ?? 'info');

  showAlert(message: string, type: AlertType = 'info'): void {
    const id = Math.random().toString(36).slice(2, 9);
    this.alerts.update(q => [...q, { id, message, type }]);
    setTimeout(() => this.dismiss(id), 5000);
  }

  dismiss(id: string): void {
    this.alerts.update(q => q.filter(a => a.id !== id));
  }

  close(): void {
    const first = this.alerts()[0];
    if (first) this.dismiss(first.id);
  }
}