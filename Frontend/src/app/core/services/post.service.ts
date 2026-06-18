import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  week_number?: number;
  tags: string[];
  seo_title?: string;
  seo_description?: string;
  og_image_url?: string;
  read_time: number;
  impressions: number;
  views: number;
  published_at?: string;
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
  status?: 'draft' | 'published' | 'archived';
  is_featured?: boolean;
  week_number?: number;
  tags?: string[];
  cover_image_url?: string;
  linkedin_url?: string;
  seo_title?: string;
  seo_description?: string;
  og_image_url?: string;
}

// ── Service ───────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PostService {
  private http = inject(HttpClient);
  private base = `${environment.baseUrl}/api/v1/posts`;

  // ── PUBLIC ─────────────────────────────────────────────────

  getAll(params: { page?: number; limit?: number; tag?: string; search?: string } = {}): Observable<{ data: PostsResponse }> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        httpParams = httpParams.set(k, String(v));
      }
    });
    return this.http.get<{ data: PostsResponse }>(this.base, { params: httpParams });
  }

  getBySlug(slug: string): Observable<{ data: { post: Post } }> {
    return this.http.get<{ data: { post: Post } }>(`${this.base}/slug/${slug}`);
  }

  getFeatured(limit = 3): Observable<{ data: { posts: Post[] } }> {
    return this.http.get<{ data: { posts: Post[] } }>(`${this.base}/featured`, {
      params: new HttpParams().set('limit', limit)
    });
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

  create(data: PostCreateDTO): Observable<{ data: { post: Post } }> {
    return this.http.post<{ data: { post: Post } }>(this.base, data, { withCredentials: true });
  }

  update(id: string, data: Partial<PostCreateDTO>): Observable<{ data: { post: Post } }> {
    return this.http.put<{ data: { post: Post } }>(`${this.base}/${id}`, data, { withCredentials: true });
  }

  updateImpressions(id: string, impressions: number): Observable<any> {
    return this.http.patch<any>(`${this.base}/${id}/impressions`, { impressions }, { withCredentials: true });
  }

  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/${id}`, { withCredentials: true });
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
