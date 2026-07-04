import { Injectable, signal } from '@angular/core';

export type DialogTone = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmDialogConfig {
  /** Bold heading, e.g. "Delete Post" */
  title?: string;
  /** Body text (required) */
  message: string;
  /** Material icon override — defaults per tone */
  icon?: string;
  /** Drives the icon/button colors. Default 'info'. */
  tone?: DialogTone;
  /** Confirm button label. Default "Confirm" (or "OK" for notices). */
  confirmLabel?: string;
  /** Cancel button label. Default "Cancel". */
  cancelLabel?: string;
  /** false = single-button notice dialog (no cancel). Default true. */
  showCancel?: boolean;
}

/**
 * Promise-based confirm/notice dialog — replaces PrimeNG ConfirmDialog and
 * per-component inline dialogs. One global <app-confirm-dialog> instance
 * is mounted in AppComponent.
 *
 * Usage:
 *   const ok = await this.confirmDialog.confirmDelete(post.title);
 *   if (ok) { ...delete... }
 *
 *   this.confirmDialog.success('Message sent successfully!', { title: 'Thank you' });
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  /** Currently open dialog (null = closed). Read by ConfirmDialogComponent. */
  readonly active = signal<Required<Pick<ConfirmDialogConfig, 'message'>> & ConfirmDialogConfig | null>(null);

  private resolver: ((confirmed: boolean) => void) | null = null;

  /** Generic two-button confirmation. Resolves true on confirm, false on cancel/dismiss. */
  confirm(config: ConfirmDialogConfig): Promise<boolean> {
    // Only one dialog at a time — cancel any dialog already open
    this.resolve(false);

    this.active.set({
      tone:        'info',
      showCancel:  true,
      confirmLabel: config.showCancel === false ? 'OK' : 'Confirm',
      cancelLabel: 'Cancel',
      ...config,
    });

    return new Promise<boolean>(res => { this.resolver = res; });
  }

  /** Danger-styled delete confirmation for a named item */
  confirmDelete(itemName: string, opts: Partial<ConfirmDialogConfig> = {}): Promise<boolean> {
    return this.confirm({
      title:        'Delete',
      message:      `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
      tone:         'danger',
      icon:         'delete_forever',
      confirmLabel: 'Delete',
      ...opts,
    });
  }

  /** Single-button informational notice (OK). Resolves true when acknowledged. */
  info(message: string, opts: Partial<ConfirmDialogConfig> = {}): Promise<boolean> {
    return this.confirm({ message, tone: 'info', showCancel: false, ...opts });
  }

  /** Single-button success notice, e.g. "Message sent successfully" */
  success(message: string, opts: Partial<ConfirmDialogConfig> = {}): Promise<boolean> {
    return this.confirm({ message, tone: 'success', showCancel: false, ...opts });
  }

  /** Two-button warning confirmation */
  warning(message: string, opts: Partial<ConfirmDialogConfig> = {}): Promise<boolean> {
    return this.confirm({ message, tone: 'warning', ...opts });
  }

  /** Called by the dialog component when the user acts */
  resolve(confirmed: boolean): void {
    const res = this.resolver;
    this.resolver = null;
    this.active.set(null);
    res?.(confirmed);
  }
}
