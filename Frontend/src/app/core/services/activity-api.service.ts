import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environments';

export interface LoginEntry {
  id: string;
  timestamp: string;
  browser: string | null;
  ip: string | null;
}

export interface FieldChange {
  id: string;
  event_type: string;
  entity: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  meta: Record<string, any> | null;
  created_at: string;
}

export interface ActivityFeedItem {
  id: string;
  event_type: string;
  entity: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  meta: Record<string, any> | null;
  created_at: string;
}

export interface ActivitySummary {
  totalLogins: number;
  profileUpdatesLast30d: number;
  lastActiveAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class ActivityApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.baseUrl + '/api/v1/activity';

  getLogins(limit = 30) {
    return this.http
      .get<{ data: { logins: LoginEntry[]; total: number } }>(
        `${this.baseUrl}/logins`,
        { params: { limit }, withCredentials: true }
      )
      .pipe(map(r => r.data));
  }

  getFieldChanges(params?: { entity?: string; limit?: number }) {
    return this.http
      .get<{ data: { changes: FieldChange[] } }>(
        `${this.baseUrl}/field-changes`,
        { params: params as any, withCredentials: true }
      )
      .pipe(map(r => r.data));
  }

  getFeed(params?: { event_type?: string; entity?: string; page?: number; limit?: number }) {
    return this.http
      .get<{ data: { items: ActivityFeedItem[]; total: number; page: number; limit: number } }>(
        `${this.baseUrl}/feed`,
        { params: params as any, withCredentials: true }
      )
      .pipe(map(r => r.data));
  }

  getSummary() {
    return this.http
      .get<{ data: ActivitySummary }>(`${this.baseUrl}/summary`, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  getSchedulerEvents(since?: string) {
    const params: any = {};
    if (since) params.from = since;
    return this.http
      .get<{ data: { items: ActivityFeedItem[]; total: number; page: number; limit: number } }>(
        `${this.baseUrl}/feed`,
        { params: { ...params, event_type: 'scheduled_post_published,scheduled_post_failed', limit: 10 }, withCredentials: true }
      )
      .pipe(map(r => r.data));
  }

  deleteLog(id: string) {
    return this.http.delete(`${this.baseUrl}/logs/${id}`, { withCredentials: true });
  }

  deleteAllLogs() {
    return this.http.delete(`${this.baseUrl}/logs`, { withCredentials: true });
  }
}
