import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ThemeService } from '../../theme.service';

@Component({
  selector: 'app-christmas-animation',
  standalone: true,
  imports: [], // No longer need CommonModule, NgIf, or NgFor
  templateUrl: './christmas-animation.component.html',
  styleUrl: './christmas-animation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChristmasAnimationComponent {
  private themeService = inject(ThemeService);

  // v18 Signals for performance
  isChristmas = computed(() => this.themeService.isChristmasTheme());
  showAnimations = signal(true);

  // Data for loops
  sparkles = Array.from({ length: 50 });
  winds = Array.from({ length: 6 });
  bulbs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  toggleAnimations() {
    this.showAnimations.update(v => !v);
  }
}