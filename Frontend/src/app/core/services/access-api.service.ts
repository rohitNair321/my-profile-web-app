import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environments';

export interface GrantablePage {
  key: string; label: string; route: string; scope: string; grantable: boolean;
}
export interface SectionConfig {
  showSidebarToggle?: boolean;
  showAgentChat?: boolean;
  showUserProfileView?: boolean;
  showNotifications?: boolean;
}
export interface ManagedUser {
  id: string; email: string; role: string; is_active: boolean;
  last_login: string | null; created_at: string; pages: string[];
  app_config?: SectionConfig | null;
}
export interface ProvisionResult { user: ManagedUser; tempPassword: string; }
export interface MyAccess { role: string; pages: string[]; }

/** Client for the super-admin Access console (Backend /api/v1/access). */
@Injectable({ providedIn: 'root' })
export class AccessApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.baseUrl + '/api/v1/access';
  private readonly opts = { withCredentials: true };

  getPages(): Observable<GrantablePage[]> {
    return this.http.get<{ data: GrantablePage[] }>(`${this.baseUrl}/pages`, this.opts).pipe(map(r => r.data));
  }

  getMyPages(): Observable<MyAccess> {
    return this.http.get<{ data: MyAccess }>(`${this.baseUrl}/my-pages`, this.opts).pipe(map(r => r.data));
  }

  listUsers(): Observable<ManagedUser[]> {
    return this.http.get<{ data: ManagedUser[] }>(`${this.baseUrl}/users`, this.opts).pipe(map(r => r.data));
  }

  createUser(body: { email: string; role: string; pages: string[] }): Observable<ProvisionResult> {
    return this.http.post<{ data: ProvisionResult }>(`${this.baseUrl}/users`, body, this.opts).pipe(map(r => r.data));
  }

  updateAccess(id: string, pages: string[]): Observable<{ userId: string; pages: string[] }> {
    return this.http.patch<{ data: { userId: string; pages: string[] } }>(
      `${this.baseUrl}/users/${id}/access`, { pages }, this.opts).pipe(map(r => r.data));
  }

  setStatus(id: string, isActive: boolean): Observable<ManagedUser> {
    return this.http.patch<{ data: ManagedUser }>(
      `${this.baseUrl}/users/${id}/status`, { isActive }, this.opts).pipe(map(r => r.data));
  }

  updateConfig(id: string, config: SectionConfig): Observable<{ id: string; app_config: SectionConfig }> {
    return this.http.patch<{ data: { id: string; app_config: SectionConfig } }>(
      `${this.baseUrl}/users/${id}/config`, { config }, this.opts).pipe(map(r => r.data));
  }
}
