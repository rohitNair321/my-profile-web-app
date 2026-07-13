import { HttpClient } from "@angular/common/http";
import { inject, Injectable, Signal, signal } from "@angular/core";
import { EMPTY, map, Observable, of, switchMap, tap, timer } from "rxjs";
import { LocalStorageService } from "src/app/shared/services/local-storage.service";
import { environment } from "src/environments/environments";

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'USER' | 'GUEST' | null;

/** Map a backend role string ('admin'|'superadmin'|'user'|'guest') to a UserRole. */
export function mapBackendRole(raw?: string | null): UserRole {
  switch ((raw || '').toLowerCase()) {
    case 'superadmin': return 'SUPERADMIN';
    case 'admin':      return 'ADMIN';
    case 'user':       return 'USER';
    default:           return 'GUEST';
  }
}

@Injectable({ providedIn: 'root' })
export class AppService {

    private readonly http = inject(HttpClient);
    private localStorageService = inject(LocalStorageService);

    // Single source of truth
    appState = signal<AppState>(initialState);
    role = signal<UserRole>(null);
    private readonly apiProfileUrl = environment.baseUrl + '/api/v1/profile';
    private readonly apiContactUrl = environment.baseUrl + '/api/v1/contact';
    private readonly apiAIChatUrl = environment.baseUrl + '/api/v1/chat/send';

    _profile = signal<Profile | null>(null);
    readonly profile: Signal<Profile | null> = this._profile;

    _notifications = signal<Notification | null>(null);
    readonly notifications: Signal<Notification | null> = this._notifications;

    // Session is carried by the backend's httpOnly cookie — the JWT is never
    // persisted to localStorage (XSS hardening). Role is restored via /auth/init.
    token = signal<string | null>(null);

    // Page keys the signed-in user may access (drives the admin sidebar / guard
    // for USER-tier accounts). Populated from GET /api/v1/access/my-pages.
    accessiblePages = signal<string[]>([]);
    setAccessiblePages(pages: string[]): void { this.accessiblePages.set(pages ?? []); }

    // Server-driven layout config from GET /api/v1/auth/init (called first, on
    // startup). `isMobile` is NOT server-driven — the shell sets it at runtime.
    appConfiguration = signal<Record<string, any> | null>(null);
    setAppConfiguration(cfg: Record<string, any> | null): void { this.appConfiguration.set(cfg ?? null); }

    hasValidToken(): boolean {
        return this.role() === 'ADMIN' || this.role() === 'SUPERADMIN';
    }


    // Fetch profile from server and update signal.
    // Cached: once the signal is populated, callers get it without a network
    // round-trip. Pass force=true to bypass (e.g. after out-of-band changes) —
    // updateProfile() already refreshes the signal on save.
    getProfile(force = false): Observable<Profile | null> {
        const cached = this._profile();
        if (cached && !force) return of(cached);
        return this.http.get<{ profile: Profile | null }>(`${this.apiProfileUrl}`, {withCredentials: true})
            .pipe(
                map(r => r.profile || null),
                tap(p => this._profile.set(p))
            );
    }

    /**
     * Fetch a specific owner's public profile (multi-tenant /u/:id view).
     * Does NOT touch the cached `_profile` signal — keeps the primary
     * portfolio's state intact while viewing another owner.
     */
    getPublicProfile(ownerId: string): Observable<Profile | null> {
        return this.http.get<{ profile: Profile | null }>(
            `${this.apiProfileUrl}`, { params: { owner: ownerId }, withCredentials: true }
        ).pipe(map(r => r.profile || null));
    }

    updateProfile(formData: FormData): Observable<Profile> {
        return this.http.put<{ profile: Profile }>(`${this.apiProfileUrl}`, formData, {withCredentials: true}).pipe(
            map(r => r.profile),
            tap(updated => this._profile.set(updated))
        );
    }

    getResumeSignedUrl(): Observable<{ url: string, expires_in: number }> {
        return this.http.get<{ url: string, expires_in: number }>(`${this.apiProfileUrl}/resume`, {withCredentials: true});
    }

    deleteResume(): Observable<Profile> {
        return this.http.delete<{ profile: Profile }>(`${this.apiProfileUrl}/resume`, {withCredentials: true}).pipe(
            map(r => r.profile),
            tap(updated => this._profile.set(updated))
        );
    }

    setLocalProfile(profile: Profile | null) {
        this._profile.set(profile);
    }

    /**
     * Wipe every user-scoped signal so no data leaks across a login/logout on
     * the same tab (SPA navigation does NOT reload the app). Call on both login
     * and logout. Role is handled separately by the caller.
     */
    resetUserScopedState(): void {
        this._profile.set(null);
        this._notifications.set(null);
        this.accessiblePages.set([]);
        this.appConfiguration.set(null);
    }

    sendContactMessage(formData: any): Observable<any> {
        return this.http.post<any>(`${this.apiContactUrl}/send`, formData, {withCredentials: true}).pipe(
            map((res) => {
                return res;
            })
        );
    }

    /** Admin: draft an AI reply to a contact message (editable before sending). */
    aiReplyDraft(payload: { name?: string; email?: string; subject?: string; message: string; tone?: string }):
        Observable<{ success: boolean; reply: string }> {
        return this.http.post<{ success: boolean; reply: string }>(
            `${this.apiContactUrl}/ai-reply`, payload, { withCredentials: true }
        );
    }

    /** Public: draft a contact-form message for a visitor ("help me write"). */
    aiComposeMessage(payload: { name?: string; subject?: string }):
        Observable<{ success: boolean; message: string }> {
        return this.http.post<{ success: boolean; message: string }>(
            `${this.apiContactUrl}/ai-compose`, payload
        );
    }

    getNotifications(): Observable<Notification> {
        if (this.role() === 'ADMIN') {
            return timer(0, 20 * 60 * 1000).pipe(
                switchMap(() => this.http.get<Notification>(`${this.apiContactUrl}/notifications`, {withCredentials: true})),
                map(notification => notification || null),
                tap(notification => this._notifications.set(notification))
            );
        }
        return EMPTY;
    }

    markMessageAsRead(id: string): Observable<Notification> {
        return this.http.put<Notification>(`${this.apiContactUrl}/notifications/${id}/read`, {}, {withCredentials: true}).pipe(
            map(notification => notification || null),
            tap(notification => this._notifications.set(notification))
        );
    }

    deleteMessage(id: string): Observable<Notification> {
        return this.http.delete<Notification>(`${this.apiContactUrl}/delete/${id}`, {withCredentials: true}).pipe(
            map(notification => notification || null),
            tap(notification => this._notifications.set(notification))
        );
    }

    setRole(newRole: UserRole) {
        this.role.set(newRole);
    }

    // A simple check to see if we should allow entry to the app
    isAuthorized(): boolean {
        return this.role() === 'ADMIN' || this.role() === 'GUEST';
    }

    intialAppState() {
        this.appState.set(initialState);
        this.localStorageService.clear();
    }

    aiChat(message: string, sessionId: string | null): Observable<AiChatResponse> {
        const payload: Record<string, string> = {
            message,
        };

        const profileId = this.profile()?.id;
        const normalizedRole = this.role()?.toLowerCase();

        if (sessionId) {
            payload['sessionId'] = sessionId;
        }

        if (profileId) {
            payload['userId'] = profileId;
        }

        if (normalizedRole === 'admin' || normalizedRole === 'guest') {
            payload['role'] = normalizedRole;
        }

        return this.http.post<{ data: AiChatResponse }>(this.apiAIChatUrl, payload)
            .pipe(map(r => r.data));
    }

}

interface AppState {
    role: UserRole;
    token: string | null;
    _profile: Profile | null;
    _notification: Notification | null;
}

const initialState: AppState = {
    role: null,
    token: null,
    _profile: null,
    _notification: null
};

export interface Notification {
    notificationList: NotificationDTO[];
    success: string;
    unreadCount: number;
}

export interface NotificationDTO {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    message: string;
    is_read: boolean;
    created_at: string;
}
export interface ContactMessage {
    id?: string;
    first_name: string;
    last_name: string;
    email: string;
    message: string;
}
export interface Experience {
    role: string;
    company: string;
    startDate: string;
    endDate?: string;
    present?: boolean;
    description?: string;
}

export interface Profile {
    id?: string;
    full_name?: string;
    description?: string;
    short_bio?: string;
    about_heading?: string;
    about_role?: string;
    email?: string;
    primary_phone?: string;
    logo_initials?: string;
    secondary_phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    open_to_work?: boolean;
    skills?: string[];
    experiences?: ExperienceDTO[];
    currenttheme?: string;
    themes?: ThemeDefinition[];
    avatar_url?: string;
    resume_url?: string;
    created_at?: string;
    updated_at?: string;
}
export interface ProfileUpdateDTO {
    full_name?: string;
    description?: string;
    email?: string;
    primary_phone?: string;
    secondary_phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    open_to_work?: boolean;
    skills?: string[];
    experiences?: ExperienceDTO[];
    avatar?: File;
    resume?: File;
}

export interface ExperienceDTO {
    role: string;
    company: string;
    startDate: string;
    endDate?: string;
    present?: boolean;
    description?: string;
    projects?: ProjectDTO[];
}

export interface ProjectDTO {
    name: string;
    description?: string;
    techStack?: string[];
    link?: string;
    highlights?: string[];
}

export interface ThemeDefinition {
    id: string;
    name: string;
    tokens: Record<string, string>;
    darkTokens?: Record<string, string>;
}

interface AiChatResponse {
    response: string;
    sessionId: string;
    limitReached?: boolean;
}

