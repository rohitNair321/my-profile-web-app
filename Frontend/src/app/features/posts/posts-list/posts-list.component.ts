import { Component, OnInit, inject, signal, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PostService, Post } from 'src/app/core/services/post.service';
import { PostCardComponent } from 'src/app/shared/components/post-card/post-card.component';
import { SeoService } from 'src/app/core/services/seo.service';
import { CommonApp } from 'src/app/core/services/common';

@Component({
  selector: 'app-posts-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PostCardComponent],
  templateUrl: './posts-list.component.html',
  styleUrls: ['./posts-list.component.scss'],
})
export class PostsListComponent extends CommonApp implements OnInit {

  private postService = inject(PostService);
  private seo = inject(SeoService);

  posts = signal<Post[]>([]);
  totalPosts = signal(0);
  totalPages = signal(0);
  currentPage = signal(1);
  isLoading = signal(true);
  error = signal<string | null>(null);

  searchQuery = '';
  selectedTag = '';
  allTags = signal<string[]>([]);

  readonly limit = 12;

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.seo.set({
      title: 'Posts — Rohit Nair',
      description: 'Thoughts on Angular, Node.js, TypeScript, and full-stack development.',
      url: 'https://www.mintpixel.in/#/posts',
    });
    this.loadPosts();
  }

  loadPosts(page = 1): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.currentPage.set(page);

    this.postService.getAll({
      page,
      limit: this.limit,
      tag: this.selectedTag || undefined,
      search: this.searchQuery || undefined,
    }).subscribe({
      next: (res) => {
        const data = res.data;
        this.posts.set(data.posts);
        this.totalPosts.set(data.pagination.total);
        this.totalPages.set(data.pagination.totalPages);

        // Collect all unique tags from loaded posts
        const tags = new Set<string>();
        data.posts.forEach(p => p.tags?.forEach(t => tags.add(t)));
        if (this.allTags().length === 0) this.allTags.set([...tags]);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Failed to load posts. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  onSearch(): void {
    this.loadPosts(1);
  }

  onTagFilter(tag: string): void {
    this.selectedTag = this.selectedTag === tag ? '' : tag;
    this.loadPosts(1);
  }

  onClearFilters(): void {
    this.searchQuery = '';
    this.selectedTag = '';
    this.loadPosts(1);
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadPosts(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }
}
