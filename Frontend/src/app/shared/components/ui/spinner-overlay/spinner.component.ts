import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from 'src/app/core/services/loading.service';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
    <div class="overlay">
      <div class="spinner-container">
        <div class="spinner" aria-live="polite" aria-busy="true" role="status"></div>
        @if (message()) {
          <p class="loading-text">{{ message() }}</p>
        }
      </div>
    </div>
    }
  `,
  styleUrls: ['./spinner.component.scss'],
})
export class SpinnerComponent {
  private loading = inject(LoadingService);

  visible = computed(() => this.loading.isLoading());
  message = computed(() => this.loading.loadingMessage());
}