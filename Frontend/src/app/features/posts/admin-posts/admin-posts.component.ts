import { Component, OnInit, inject, signal, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PostService, Post } from 'src/app/core/services/post.service';
import { CommonApp } from 'src/app/core/services/common';

type StatusFilter = '' | 'draft' | 'published' | 'archived';

@Component({
  selector: 'app-admin-posts',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-posts.component.html',
  styleUrls: ['./admin-posts.component.scss'],
})
export class AdminPostsComponent extends CommonApp implements OnInit {

  private postService = inject(PostService);

  posts = signal<Post[]>([]);
  total = signal(0);
  isLoading = signal(true);
  error = signal<string | null>(null);

  currentPage = signal(1);
  totalPages = signal(0);
  statusFilter: StatusFilter = '';
  deletingId: string | null = null;
  editingImpressions: string | null = null;
  impressionsInput = 0;

  readonly limit = 20;

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.loadPosts();
  }

  loadPosts(page = 1): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.currentPage.set(page);

    this.postService.getAllAdmin({
      page,
      limit: this.limit,
      status: this.statusFilter || undefined,
    }).subscribe({
      next: (res) => {
        const data = res.data;
        this.posts.set(data.posts);
        this.total.set(data.total);
        this.totalPages.set(Math.ceil(data.total / this.limit));
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load posts. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  onFilterChange(): void {
    this.loadPosts(1);
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadPosts(page);
  }

  deletePost(id: string, title: string): void {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    this.deletingId = id;
    this.postService.delete(id).subscribe({
      next: () => {
        this.deletingId = null;
        this.loadPosts(this.currentPage());
      },
      error: () => {
        this.deletingId = null;
        this.alertService.showAlert('Failed to delete post. Try again.', 'error');
      }
    });
  }

  startEditImpressions(post: Post): void {
    this.editingImpressions = post.id;
    this.impressionsInput = post.impressions;
  }

  saveImpressions(id: string): void {
    this.postService.updateImpressions(id, this.impressionsInput).subscribe({
      next: () => {
        this.editingImpressions = null;
        this.loadPosts(this.currentPage());
      },
      error: () => {
        this.alertService.showAlert('Failed to update impressions.', 'error');
      }
    });
  }

  cancelEditImpressions(): void {
    this.editingImpressions = null;
  }

  toggleFeatured(post: Post): void {
    this.postService.update(post.id, { is_featured: !post.is_featured }).subscribe({
      next: () => this.loadPosts(this.currentPage()),
      error: () => this.alertService.showAlert('Failed to update post.', 'error')
    });
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      draft: 'badge--draft',
      published: 'badge--published',
      archived: 'badge--archived',
    };
    return map[status] || '';
  }

  formatDate(date?: string): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }
}
