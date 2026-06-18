import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environments';
import { AppService } from "./app.service";

export interface ChatJsonMessage {
    sender: 'user' | 'bot';
    text: string;
    time: string;
}

export interface ChatSessionDto {
    id: string;
    title: string;
    model?: string;
    user_id?: string;
    messages: ChatJsonMessage[];
    created_at: string;
    updated_at: string;
}

export interface UsageSummary {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
}

export interface UsageTrend {
    date: string;
    tokens: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requests: number;
}

export interface ModelBreakdown {
    model: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requests: number;
}

export interface RoleBlock {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requests: number;
}

export interface SessionSummary {
    sessionId: string;
    date: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requests: number;
    model: string;
}

export interface AllTimeBlock {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalRequests: number;
    totalCost: number;
}

export interface UsageResponse {
    summary: UsageSummary;
    trend: UsageTrend[];
    byModel: ModelBreakdown[];
    byRole: { admin: RoleBlock; guest: RoleBlock };
    sessions: SessionSummary[];
    allTime: AllTimeBlock;
}

export interface BalanceResponse {
    source: 'openai' | 'supabase';
    totalUsedUSD: number;
    hardLimitUSD: number | null;
    remainingUSD: number | null;
    remainingPct: number | null;
}

@Injectable({
    providedIn: 'root'
})
export class ChatApiService {

    // v1 base — new architecture
    private readonly apiV1ChatUrl = environment.baseUrl + '/api/v1/chat';
    // Legacy base — kept for endpoints not yet in v1 (balance, createSession, saveMessage)
    private readonly apiLegacyChatUrl = environment.baseUrl + '/api/chat';
    private appService = inject(AppService);

    constructor(private http: HttpClient) { }

    getSessions(): Observable<ChatSessionDto[]> {
        return this.http.get<{ data: ChatSessionDto[] }>(
            `${this.apiV1ChatUrl}/sessions`, { withCredentials: true }
        ).pipe(map(r => r.data));
    }

    getSession(id: string): Observable<ChatSessionDto> {
        return this.http.get<{ data: ChatSessionDto }>(
            `${this.apiV1ChatUrl}/sessions/${id}`, { withCredentials: true }
        ).pipe(map(r => r.data));
    }

    deleteSession(id: string) {
        return this.http.delete(
            `${this.apiV1ChatUrl}/sessions/${id}`, { withCredentials: true }
        );
    }

    deleteAllSessions() {
        return this.http.delete(
            `${this.apiV1ChatUrl}/sessions`, { withCredentials: true }
        );
    }

    getUsage(params?: { userId?: string; sessionId?: string; range?: string; }) {
        return this.http.get<any>(
            `${this.apiV1ChatUrl}/stats`, { params: params as any, withCredentials: true }
        ).pipe(map(r => r.data));
    }

    // ── Legacy endpoints (no v1 equivalent yet) ──────────────────

    getBalance(): Observable<BalanceResponse> {
        return this.http.get<{ data: BalanceResponse }>(
            `${this.apiV1ChatUrl}/balance`, { withCredentials: true }
        ).pipe(map(r => r.data));
    }

    createSession(title: string): Observable<ChatSessionDto> {
        return this.http.post<ChatSessionDto>(
            `${this.apiLegacyChatUrl}/createSession`,
            { title, model: 'o4-mini', userId: this.appService.profile()?.id }
        );
    }

    saveMessage(sessionId: string | null, sender: 'user' | 'bot', message: string): Observable<any> {
        return this.http.post(
            `${this.apiLegacyChatUrl}/message`,
            { sessionId, sender, message, userId: this.appService.profile()?.id },
            { withCredentials: true }
        );
    }

    getMessages(sessionId: string): Observable<ChatSessionDto[]> {
        return this.http.get<ChatSessionDto[]>(
            `${this.apiLegacyChatUrl}/messages/${sessionId}`, { withCredentials: true }
        );
    }

}