import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type SkeletonType = 'text' | 'circle' | 'card' | 'block';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="skeleton"
      [class.skeleton--text]="type === 'text'"
      [class.skeleton--circle]="type === 'circle'"
      [class.skeleton--card]="type === 'card'"
      [style.width]="width"
      [style.height]="height"
      role="status"
      aria-label="Loading..."
    ></div>
  `,
  styles: [`
    .skeleton {
      display: block;
      background: linear-gradient(
        90deg,
        var(--surface, #f0f0f0) 25%,
        var(--surface-alt, #e0e0e0) 50%,
        var(--surface, #f0f0f0) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
      border-radius: var(--radius-md, 8px);
    }

    .skeleton--text {
      height: 1em;
      border-radius: var(--radius-full, 9999px);
    }

    .skeleton--circle {
      border-radius: 50%;
    }

    .skeleton--card {
      height: 200px;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class SkeletonComponent {
  @Input() type: SkeletonType = 'block';
  @Input() width  = '100%';
  @Input() height = '1rem';
}
