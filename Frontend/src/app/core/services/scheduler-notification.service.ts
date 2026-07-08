import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from 'src/environments/environments';

export interface PostPublishedEvent {
  post_id: string;
  title: string;
  slug: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class SchedulerNotificationService implements OnDestroy {
  private es: EventSource | null = null;
  private readonly _published$ = new Subject<PostPublishedEvent>();
  readonly published$ = this._published$.asObservable();

  // ── Seen-event tracking (id-based, not timestamp) ──────────────
  // A scheduler notification is shown once per event id, then remembered
  // forever. Immune to client/server clock skew — only genuinely NEW
  // scheduled-post events (new ids) ever surface again.
  private readonly SEEN_KEY = 'sched-notif-seen-ids';
  private readonly MAX_SEEN = 200;

  constructor(private zone: NgZone) {}

  private _readSeen(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const arr = JSON.parse(localStorage.getItem(this.SEEN_KEY) ?? '[]');
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  }

  /** Given fetched scheduler events, return only those not yet seen. */
  filterUnseen<T extends { id: string }>(items: T[]): T[] {
    const seen = this._readSeen();
    return items.filter(i => i.id && !seen.has(i.id));
  }

  /** Mark event ids as seen so they never notify again. */
  markSeen(ids: string[]): void {
    if (typeof localStorage === 'undefined' || ids.length === 0) return;
    const seen = this._readSeen();
    for (const id of ids) if (id) seen.add(id);
    // Keep only the most recent MAX_SEEN ids to bound storage growth
    const trimmed = Array.from(seen).slice(-this.MAX_SEEN);
    localStorage.setItem(this.SEEN_KEY, JSON.stringify(trimmed));
  }

  connect(): void {
    if (this.es) return;
    const url = `${environment.baseUrl}/api/v1/posts/scheduler-stream`;
    this.es = new EventSource(url, { withCredentials: true });

    this.es.addEventListener('post_published', (e: MessageEvent) => {
      this.zone.run(() => {
        try { this._published$.next(JSON.parse(e.data)); } catch { /* skip malformed */ }
      });
    });

    this.es.onerror = () => {
      // EventSource auto-reconnects after error — no manual action needed
    };
  }

  disconnect(): void {
    this.es?.close();
    this.es = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
    this._published$.complete();
  }
}
