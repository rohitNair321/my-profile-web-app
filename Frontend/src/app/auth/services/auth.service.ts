import { inject, Injectable, Injector, signal } from '@angular/core';
import { catchError, debounceTime, forkJoin, map, mergeMap, Observable, of, tap } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environments';
import { AppService, UserRole, mapBackendRole } from 'src/app/core/services/app.service';
import { LocalStorageService } from 'src/app/shared/services/local-storage.service';
import { PostService } from 'src/app/core/services/post.service';
import { TaskService } from 'src/app/core/services/task.service';
import { ThemeService } from 'src/app/core/theme/theme.service';
import { Router } from '@angular/router';
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly http = inject(HttpClient);
  private localStorageService = inject(LocalStorageService);
  private router = inject(Router);
  private injector = inject(Injector);
  public appService = inject(AppService);

  /**
   * Wipe ALL user-scoped in-memory state so nothing leaks across a login/logout
   * in the same tab. Services are fetched lazily via the injector so this call
   * never eagerly instantiates them at app bootstrap.
   */
  private clearSessionData(): void {
    // Whether the session being torn down had admin data worth clearing. Checked
    // BEFORE the role is overwritten so we don't needlessly instantiate the
    // admin-only TaskService (its ctor fetches /tasks) for a guest→user login.
    const hadPrivilegedSession = this.role() === 'ADMIN' || this.role() === 'SUPERADMIN';

    this.appService.resetUserScopedState();
    this.injector.get(PostService).reset();   // cache-only, no network
    this.injector.get(ThemeService).reset();  // always already instantiated
    if (hadPrivilegedSession) this.injector.get(TaskService).reset();
  }

  role = signal<UserRole>(null);
  // Set on login when the account must reset its temp password before proceeding.
  mustChangePassword = signal<boolean>(false);
private readonly apiV1BaseUrl = environment.baseUrl + '/api/v1/auth';
  private httpOptions = {
    withCredentials: true
  };
  user = signal<any | null>(null);
  token = signal<string | null>(null);

  private authHeaders(): any {
    // const token = this.token() || this.localStorageService.getItem('auth_token');
    // return new HttpHeaders({ Authorization: token ? `Bearer ${token}` : '' });
    return this.httpOptions;
  }
  // Fetch profile data from Json.
  getCombinedData(): Observable<any> {
    return this.http.get<any>('assets/data/profile.json').pipe(
      debounceTime(100)
    );
  }

  register(payload: RegisterRequest): Observable<any> {
    return this.http.post(`${this.apiV1BaseUrl}/register`, payload);
  }

  login(payload: LoginRequest): Observable<any> {
    return this.http.post<any>(`${this.apiV1BaseUrl}/login`, payload, this.httpOptions).pipe(
      map((res) => {
        // Clear any previous user's cached data BEFORE adopting the new identity
        // (SPA login does not reload the app, so singletons would otherwise leak).
        this.clearSessionData();

        // Token kept in-memory only; the httpOnly cookie set by the backend is
        // the persistent credential. Never write the JWT to localStorage —
        // anything there is readable by any XSS payload.
        this.token.set(res.data.token);
        this.user.set(res.data.user);
        const role = mapBackendRole(res.data.user.role);
        this.role.set(role);
        this.appService.setRole(role);
        this.mustChangePassword.set(res.data.user.mustChangePassword === true);
      })
    );
  }

/**
 * Initialize app - Called on app startup to restore session
 * Integrates with backend /api/v1/auth/init endpoint
 * Handles both admin (JWT token) and guest (cookie) sessions
 */
initiateApp(): Observable<any> {
  return this.http.get<any>(`${this.apiV1BaseUrl}/init`, this.httpOptions).pipe(
    tap((res: any) => {
      // Backend returns standardized response format
      const data = res.data || res;
      const role: UserRole = mapBackendRole(data.role);

      // Server-driven layout config (init is the first call on startup)
      this.appService.setAppConfiguration(data.appConfiguration ?? null);

      // Update local state
      this.role.set(role);
      this.appService.setRole(role);
      this.user.set({ 
        email: data.email, 
        id: data.id, 
        role: data.role 
      });

      // Load profile if available
      // if (data.appData) {
      //   this.appService.setLocalProfile(data.appData);
      // }

    }),
    catchError((error) => {
      console.warn('⚠️ Session restore failed, defaulting to guest', error);
      // Default to guest if init fails
      this.role.set('GUEST');
      this.appService.setRole('GUEST');
      return of({ role: 'guest', id: null, email: null });
    })
  );
}

  loginWithGoogle(): Observable<any> {
    // TODO: integrate Google OAuth / Supabase OAuth
    return of({ success: true });
  }

  loginWithFacebook(): Observable<any> {
    // TODO: integrate Facebook OAuth / Supabase OAuth
    return of({ success: true });
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiV1BaseUrl}/forgot-password`, { email }, this.httpOptions);
  }

  resetPassword(token?: string, password?: string): Observable<any> {
    // token comes from the emailed reset link's query param — never the session JWT
    return this.http.post(`${this.apiV1BaseUrl}/reset-password`, { token, password });
  }

  updatePassword(passwordData: any): Observable<any> {
    return this.http.put(`${this.apiV1BaseUrl}/update-password`, passwordData, this.httpOptions);
  }

  getPasswordStatus(): Observable<{
    lastUpdatedAt: string | null;
    daysUntilExpiry: number;
    isExpired: boolean;
    isWarning: boolean;
  }> {
    return this.http
      .get<any>(`${this.apiV1BaseUrl}/password-status`, this.httpOptions)
      .pipe(map((r: any) => r.data));
  }

  logoutState(): void {
    this.user.set(null);
    this.role.set(null);
    this.token.set(null);
    this.appService.setRole('GUEST');
    this.clearSessionData();      // profile, notifications, access, config, posts, tasks, theme
    this.localStorageService.clear();
  }

  logout(): void {
    this.http.post(`${this.apiV1BaseUrl}/logout`, {}).subscribe({
      next: () => {
        this.logoutState();
        location.href = '/';
      },
      error: () => {
        this.logoutState();
        location.href = '/';
      }
    });
  }

}
