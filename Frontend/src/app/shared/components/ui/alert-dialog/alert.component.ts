import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertService } from 'src/app/core/services/alert.service';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlertComponent {
  public alertService = inject(AlertService);

  iconFor(type: string): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error':   return 'error';
      case 'warning': return 'warning';
      default:        return 'info';
    }
  }
}
