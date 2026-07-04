import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { ConfirmDialogService, DialogTone } from 'src/app/core/services/confirm-dialog.service';

const TONE_ICONS: Record<DialogTone, string> = {
  danger:  'delete_forever',
  warning: 'warning_amber',
  info:    'info',
  success: 'check_circle',
};

const TONE_TITLES: Record<DialogTone, string> = {
  danger:  'Are you sure?',
  warning: 'Warning',
  info:    'Information',
  success: 'Success',
};

/**
 * Global confirm/notice dialog — mounted once in AppComponent.
 * Driven entirely by ConfirmDialogService (promise-based). No PrimeNG.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly dialog = inject(ConfirmDialogService);

  iconFor(tone: DialogTone | undefined, icon: string | undefined): string {
    return icon || TONE_ICONS[tone ?? 'info'];
  }

  titleFor(tone: DialogTone | undefined, title: string | undefined): string {
    return title || TONE_TITLES[tone ?? 'info'];
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.dialog.active()) this.dialog.resolve(false);
  }
}
