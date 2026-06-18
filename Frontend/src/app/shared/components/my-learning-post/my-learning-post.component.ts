import { CommonModule } from '@angular/common';
import { Component, computed, signal , ChangeDetectionStrategy } from '@angular/core';

interface LearningPost {
  id: number;
  title: string;
  summary: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  date: string;
  tags: string[];
}

@Component({
  selector: 'app-my-learning-post',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-learning-post.component.html',
  styleUrl: './my-learning-post.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyLearningPostComponent {
  posts = signal<LearningPost[]>([
    {
      id: 1,
      title: 'Understanding Angular Signals',
      summary: 'Learned how to replace manual subscriptions with reactive signals and computed state.',
      level: 'Intermediate',
      date: '2026-04-10',
      tags: ['Angular', 'Signals', 'State'],
    },
    {
      id: 2,
      title: 'Highcharts in Standalone Components',
      summary: 'Integrated dynamic charts and improved re-render behavior using updateChange flow.',
      level: 'Advanced',
      date: '2026-04-09',
      tags: ['Highcharts', 'UI', 'Performance'],
    },
  ]);

  totalPosts = computed(() => this.posts().length);
}
