import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/environments/environments';

// ── Interfaces ─────────────────────────────────────────────────

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  content_raw?: string;
  cover_image_url?: string;
  linkedin_url?: string;
  status: 'draft' | 'published' | 'archived' | 'scheduled';
  is_featured: boolean;
  week_number?: number;
  tags: string[];
  seo_title?: string;
  seo_description?: string;
  og_image_url?: string;
  read_time: number;
  impressions: number;
  views: number;
  published_at?: string | null;
  scheduled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostsResponse {
  posts: Post[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PostCreateDTO {
  title: string;
  content: string;
  content_raw?: string;
  excerpt?: string;
  status?: 'draft' | 'published' | 'archived' | 'scheduled';
  is_featured?: boolean;
  week_number?: number;
  tags?: string[];
  cover_image_url?: string;
  linkedin_url?: string;
  seo_title?: string;
  seo_description?: string;
  og_image_url?: string;
  scheduled_at?: string | null;
}

// ── Service ───────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PostService {
  private http = inject(HttpClient);
  private base = `${environment.baseUrl}/api/v1/posts`;

  // Signal cache — featured posts rarely change; serve from memory after the
  // first fetch and invalidate on any admin write (create/update/delete).
  private _featured = signal<Post[] | null>(null);
  readonly featured = this._featured.asReadonly();

  // Per-query cache for the public list + slug reads — avoids re-fetching the
  // same page/filter when the user navigates back to /posts or reopens a post.
  private _listCache = new Map<string, PostsResponse>();
  private _slugCache = new Map<string, Post>();

  /** Clear caches after admin writes so public views refetch fresh data */
  private invalidateCache(): void {
    this._featured.set(null);
    this._listCache.clear();
    this._slugCache.clear();
  }

  // ── PUBLIC ─────────────────────────────────────────────────

  getAll(params: { page?: number; limit?: number; tag?: string; search?: string } = {}): Observable<{ data: PostsResponse }> {
    const key = JSON.stringify(params);
    const cached = this._listCache.get(key);
    if (cached) return of({ data: cached });

    let httpParams = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        httpParams = httpParams.set(k, String(v));
      }
    });
    return this.http.get<{ data: PostsResponse }>(this.base, { params: httpParams })
      .pipe(tap(r => { if (r?.data) this._listCache.set(key, r.data); }));
  }

  getBySlug(slug: string): Observable<{ data: { post: Post } }> {
    const cached = this._slugCache.get(slug);
    if (cached) return of({ data: { post: cached } });
    return this.http.get<{ data: { post: Post } }>(`${this.base}/slug/${slug}`)
      .pipe(tap(r => { if (r?.data?.post) this._slugCache.set(slug, r.data.post); }));
  }

  getFeatured(limit = 3): Observable<{ data: { posts: Post[] } }> {
    const cached = this._featured();
    if (cached) {
      return of({ data: { posts: cached.slice(0, limit) } });
    }
    return this.http.get<{ data: { posts: Post[] } }>(`${this.base}/featured`, {
      params: new HttpParams().set('limit', limit)
    }).pipe(tap(r => this._featured.set(r.data?.posts ?? [])));
  }

  trackView(id: string, guestId?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/view`, { guestId });
  }

  // ── ADMIN ──────────────────────────────────────────────────

  getAllAdmin(params: { page?: number; limit?: number; status?: string } = {}): Observable<{ data: { posts: Post[]; total: number } }> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        httpParams = httpParams.set(k, String(v));
      }
    });
    return this.http.get<{ data: { posts: Post[]; total: number } }>(
      `${this.base}/admin/all`,
      { params: httpParams, withCredentials: true }
    );
  }

  /** Single post of any status — replaces fetching the whole admin list to edit one post */
  getAdminById(id: string): Observable<{ data: { post: Post } }> {
    return this.http.get<{ data: { post: Post } }>(`${this.base}/admin/${id}`, { withCredentials: true });
  }

  create(data: PostCreateDTO): Observable<{ data: { post: Post } }> {
    return this.http.post<{ data: { post: Post } }>(this.base, data, { withCredentials: true })
      .pipe(tap(() => this.invalidateCache()));
  }

  update(id: string, data: Partial<PostCreateDTO>): Observable<{ data: { post: Post } }> {
    return this.http.put<{ data: { post: Post } }>(`${this.base}/${id}`, data, { withCredentials: true })
      .pipe(tap(() => this.invalidateCache()));
  }

  updateImpressions(id: string, impressions: number): Observable<any> {
    return this.http.patch<any>(`${this.base}/${id}/impressions`, { impressions }, { withCredentials: true });
  }

  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/${id}`, { withCredentials: true })
      .pipe(tap(() => this.invalidateCache()));
  }

  uploadCover(file: File): Observable<{ data: { url: string; path: string } }> {
    const fd = new FormData();
    fd.append('cover', file);
    return this.http.post<{ data: { url: string; path: string } }>(
      `${this.base}/upload/cover`,
      fd,
      { withCredentials: true }
    );
  }
}
