import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Post } from 'src/app/core/services/post.service';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './post-card.component.html',
  styleUrls: ['./post-card.component.scss'],
})
export class PostCardComponent {
  @Input({ required: true }) post!: Post;

  get formattedDate(): string {
    if (!this.post.published_at) return '';
    return new Date(this.post.published_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  get readLabel(): string {
    return `${this.post.read_time} min read`;
  }
}
