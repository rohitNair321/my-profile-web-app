import { Injectable, signal } from '@angular/core';

export type DialogTone = 'danger' | 'warning' | 'info' | 'success';

/** Result of a 3-way choice dialog */
export type DialogChoice = 'save' | 'discard' | 'cancel';

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
  /** When set, renders a third "discard" button and switches to choice mode. */
  discardLabel?: string;
}

/**
 * Promise-based confirm/notice/choice dialog — replaces PrimeNG ConfirmDialog and
 * per-component inline dialogs. One global <app-confirm-dialog> instance
 * is mounted in AppComponent.
 *
 * Usage:
 *   const ok = await this.confirmDialog.confirmDelete(post.title);
 *   const choice = await this.confirmDialog.choice({ ... }); // 'save' | 'discard' | 'cancel'
 *   this.confirmDialog.success('Message sent successfully!', { title: 'Thank you' });
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  /** Currently open dialog (null = closed). Read by ConfirmDialogComponent. */
  readonly active = signal<(ConfirmDialogConfig & { message: string }) | null>(null);

  private resolver: ((result: any) => void) | null = null;

  /** Generic two-button confirmation. Resolves true on confirm, false on cancel/dismiss. */
  confirm(config: ConfirmDialogConfig): Promise<boolean> {
    return this._open<boolean>(
      {
        tone:        'info',
        showCancel:  true,
        confirmLabel: config.showCancel === false ? 'OK' : 'Confirm',
        cancelLabel: 'Cancel',
        ...config,
      },
      false,
    );
  }

  /**
   * Three-way choice — Save / Discard / Cancel. Used by the unsaved-changes guard.
   * Resolves 'save' | 'discard' | 'cancel' (dismiss/ESC = 'cancel').
   */
  choice(config: ConfirmDialogConfig): Promise<DialogChoice> {
    return this._open<DialogChoice>(
      {
        tone:         'warning',
        showCancel:   true,
        confirmLabel: 'Save changes',
        discardLabel: 'Discard',
        cancelLabel:  'Keep editing',
        icon:         'save',
        ...config,
      },
      'cancel',
    );
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

  private _open<T>(config: ConfirmDialogConfig & { message: string }, dismissValue: T): Promise<T> {
    // Only one dialog at a time — resolve any dialog already open with its dismiss value
    this._dismiss();
    this.active.set(config);
    return new Promise<T>(res => { this.resolver = res; });
  }

  /** Confirm button — 'save' in choice mode, true in confirm mode */
  onConfirm(): void {
    const isChoice = !!this.active()?.discardLabel;
    this._resolve(isChoice ? 'save' : true);
  }

  /** Discard button (choice mode only) */
  onDiscard(): void {
    this._resolve('discard');
  }

  /** Cancel / backdrop / ESC — 'cancel' in choice mode, false in confirm mode */
  onCancel(): void {
    const isChoice = !!this.active()?.discardLabel;
    this._resolve(isChoice ? 'cancel' : false);
  }

  private _dismiss(): void {
    if (!this.resolver) return;
    const isChoice = !!this.active()?.discardLabel;
    this._resolve(isChoice ? 'cancel' : false);
  }

  private _resolve(result: any): void {
    const res = this.resolver;
    this.resolver = null;
    this.active.set(null);
    res?.(result);
  }
}
