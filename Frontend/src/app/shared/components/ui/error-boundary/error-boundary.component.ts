import {
  ChangeDetectionStrategy,
  Component,
  ErrorHandler,
  Injectable,
  inject,
  signal,
} from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  readonly hasError = signal(false);
  readonly errorMessage = signal('');

  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);

    // Angular passes errors from effects, change detection, and HTTP here.
    // Most of these are recoverable — only crash the UI for truly fatal errors
    // (e.g., bootstrap failures), not for component-level issues.
    if (this._isFatal(error)) {
      const msg = error instanceof Error ? error.message : String(error);
      this.hasError.set(true);
      this.errorMessage.set(msg);
    }
  }

  private _isFatal(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message ?? '';
    // Non-fatal: Angular internal codes, expression-changed errors, effect errors
    const nonFatal = [
      'ExpressionChangedAfterItHasBeenChecked',
      'NG0',        // Angular framework error codes
      'dark_tokens', // Theme token missing — handled at source
      'NullInjector',
    ];
    return !nonFatal.some(token => msg.includes(token));
  }
}

@Component({
  selector: 'app-error-boundary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (handler.hasError()) {
      <div class="error-boundary" role="alert">
        <span class="material-icons error-boundary__icon">error_outline</span>
        <h2 class="error-boundary__title">Something went wrong</h2>
        <p class="error-boundary__body">
          An unexpected error occurred. Your data is safe — reload to continue.
        </p>
        <button class="btn-primary" (click)="reload()">Reload page</button>
      </div>
    } @else {
      <ng-content />
    }
  `,
  styles: [`
    .error-boundary {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      gap: 16px;
      text-align: center;
      padding: 32px;

      &__icon {
        font-size: 3rem;
        color: var(--error, #e53e3e);
      }

      &__title {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }

      &__body {
        color: var(--text-secondary);
        max-width: 400px;
        margin: 0;
      }
    }
  `],
})
export class ErrorBoundaryComponent {
  protected readonly handler = inject(GlobalErrorHandler);

  reload(): void {
    window.location.reload();
  }
}
