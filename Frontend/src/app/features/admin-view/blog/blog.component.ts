import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdminPostsComponent } from '../posts/admin-posts/admin-posts.component';

@Component({
  selector: 'app-admin-blog',
  standalone: true,
  imports: [AdminPostsComponent],
  template: '<app-admin-posts></app-admin-posts>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBlogComponent {}
