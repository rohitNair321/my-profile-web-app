import { Component, OnInit, OnDestroy, inject, signal, Injector } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title, DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PostService, Post } from 'src/app/core/services/post.service';
import { CommonApp } from 'src/app/core/services/common';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './post-detail.component.html',
  styleUrls: ['./post-detail.component.scss'],
})
export class PostDetailComponent extends CommonApp implements OnInit, OnDestroy {

  private postService   = inject(PostService);
  private metaService   = inject(Meta);
  private titleService  = inject(Title);
  private sanitizer     = inject(DomSanitizer);
  private destroy$      = new Subject<void>();

  post = signal<Post | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const slug = params['slug'];
      if (slug) this.loadPost(slug);
    });
  }

  loadPost(slug: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.postService.getBySlug(slug).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const post = res.data.post;
        this.post.set(post);
        this.setMeta(post);
        this.trackPageView(post.id);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.status === 404 ? 'Post not found.' : 'Failed to load post.');
        this.isLoading.set(false);
      }
    });
  }

  get safeContent(): SafeHtml {
    const post = this.post();
    if (!post?.content) return '';
    return this.sanitizer.bypassSecurityTrustHtml(post.content);
  }

  get formattedDate(): string {
    const post = this.post();
    if (!post?.published_at) return '';
    return new Date(post.published_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  private setMeta(post: Post): void {
    const title = post.seo_title || post.title;
    const description = post.seo_description || post.excerpt;
    const image = post.og_image_url || post.cover_image_url;
    const url = `https://www.mintpixel.in/posts/${post.slug}`;

    this.titleService.setTitle(title);

    this.metaService.updateTag({ name: 'description', content: description || '' });
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: description || '' });
    this.metaService.updateTag({ property: 'og:image', content: image || '' });
    this.metaService.updateTag({ property: 'og:url', content: url });
    this.metaService.updateTag({ property: 'og:type', content: 'article' });
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: title });
    this.metaService.updateTag({ name: 'twitter:description', content: description || '' });
    this.metaService.updateTag({ name: 'twitter:image', content: image || '' });

    // JSON-LD structured data
    this.injectJsonLd(post);
  }

  private injectJsonLd(post: Post): void {
    // Remove any existing JSON-LD for posts
    document.querySelectorAll('script[data-post-ld]').forEach(el => el.remove());

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.excerpt,
      image: post.cover_image_url,
      datePublished: post.published_at,
      dateModified: post.updated_at,
      author: {
        '@type': 'Person',
        name: 'Rohit Nair',
        url: 'https://www.mintpixel.in'
      },
      publisher: {
        '@type': 'Person',
        name: 'Rohit Nair',
        url: 'https://www.mintpixel.in'
      }
    };

    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-post-ld', 'true');
    el.text = JSON.stringify(schema);
    document.head.appendChild(el);
  }

  private trackPageView(postId: string): void {
    this.postService.trackView(postId).subscribe();
  }

  shareOnLinkedIn(): void {
    const url = encodeURIComponent(`https://www.mintpixel.in/posts/${this.post()?.slug}`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'noopener,noreferrer');
  }

  shareOnTwitter(): void {
    const post = this.post();
    if (!post) return;
    const url = encodeURIComponent(`https://www.mintpixel.in/posts/${post.slug}`);
    const text = encodeURIComponent(post.title);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer');
  }

  copyLink(): void {
    navigator.clipboard.writeText(`https://www.mintpixel.in/posts/${this.post()?.slug}`)
      .then(() => alert('Link copied!'))
      .catch(() => {});
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.querySelectorAll('script[data-post-ld]').forEach(el => el.remove());
  }
}
