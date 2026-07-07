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

  constructor(private zone: NgZone) {}

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
