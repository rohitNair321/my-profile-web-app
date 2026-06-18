import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ThemeService } from '../../theme.service';

@Component({
  selector: 'app-new-year-animation',
  standalone: true,
  imports: [], // Removed NgFor and NgIf
  templateUrl: './new-year-animation.component.html',
  styleUrl: './new-year-animation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewYearAnimationComponent {
  private themeService = inject(ThemeService);

  // Checks for "newyear" theme using v18 Signals
  isNewYear = computed(() => this.themeService.isNewYearTheme());
  showAnimations = signal(true);

  fireworks = Array.from({ length: 5 });
  
  // Pre-calculated confetti for better performance
  confetti = Array.from({ length: 50 }).map(() => ({
    x: Math.random() * 100,
    delay: Math.random() * 5,
    color: ['#fbbf24', '#8b5cf6', '#f8fafc'][Math.floor(Math.random() * 3)]
  }));

  toggleAnimations() {
    this.showAnimations.update(v => !v);
  }
}