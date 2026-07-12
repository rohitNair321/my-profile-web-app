import { ChangeDetectionStrategy, Component, inject, Injector, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonApp } from 'src/app/core/services/common';
import { Profile } from 'src/app/core/services/app.service';
import { Post, PostService } from 'src/app/core/services/post.service';

/**
 * Public portfolio for a specific owner — `/u/:id`.
 * Renders another owner's published profile + posts (multi-tenant view) using the
 * backend's `?owner=` support, without disturbing the primary portfolio's state.
 */
@Component({
  selector: 'app-public-portfolio',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './public-portfolio.component.html',
  styleUrls: ['./public-portfolio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicPortfolioComponent extends CommonApp implements OnInit {
  private postService = inject(PostService);

  profile  = signal<Profile | null>(null);
  posts    = signal<Post[]>([]);
  isLoading = signal(true);
  notFound = signal(false);

  constructor(public override injector: Injector) { super(injector); }

  ngOnInit(): void {
    const ownerId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!ownerId) { this.notFound.set(true); this.isLoading.set(false); return; }

    this.appService.getPublicProfile(ownerId).subscribe({
      next: p => {
        if (!p) { this.notFound.set(true); this.isLoading.set(false); return; }
        this.profile.set(p);
        this.applyThemeFromProfile(p); // adopt this owner's theme for the view
        this.isLoading.set(false);
      },
      error: () => { this.notFound.set(true); this.isLoading.set(false); },
    });

    this.postService.getAll({ owner: ownerId, limit: 6 }).subscribe({
      next: r => this.posts.set(r.data?.posts ?? []),
      error: () => {},
    });
  }

  initials(p: Profile): string {
    if (p.logo_initials) return p.logo_initials;
    const parts = (p.full_name ?? '').trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
  }

  expPeriod(e: { startDate?: string; endDate?: string; present?: boolean }): string {
    const start = e.startDate ?? '';
    const end = e.present ? 'Present' : (e.endDate ?? '');
    return [start, end].filter(Boolean).join(' — ');
  }
}
