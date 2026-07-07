import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environments';
import {
  Task, TaskColumn, isRunning,
} from 'src/app/features/admin-view/planner/models/task.model';

interface Envelope<T> { data: T; }
interface StartTimerResult { task: Task; autoStopped: string | null; }

/**
 * TaskService — API-backed task store for the admin Planner (Backend /api/v1/tasks).
 * Server owns all timer timestamps; this service just mirrors state in signals.
 */
@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.baseUrl + '/api/v1/tasks';

  private _tasks = signal<Task[]>([]);
  readonly tasks = this._tasks.asReadonly();

  loading = signal(false);
  loaded  = signal(false);

  /** Live ticking clock for running timers — components read this to re-render */
  readonly now = signal(Date.now());

  constructor() {
    if (typeof window !== 'undefined') {
      setInterval(() => {
        if (this._tasks().some(isRunning)) this.now.set(Date.now());
      }, 1000);
      this.refresh();
    }
  }

  refresh(): void {
    this.loading.set(true);
    this.http.get<Envelope<Task[]>>(this.baseUrl, { withCredentials: true }).subscribe({
      next: r => {
        this._tasks.set(r.data ?? []);
        this.loading.set(false);
        this.loaded.set(true);
        this.now.set(Date.now());
      },
      error: () => this.loading.set(false),
    });
  }

  getTasks(): Observable<Task[]> {
    return this.http.get<Envelope<Task[]>>(this.baseUrl, { withCredentials: true }).pipe(
      map(r => r.data ?? []),
      tap(ts => { this._tasks.set(ts); this.loaded.set(true); }),
    );
  }

  addTask(partial: Pick<Task, 'title' | 'column'> & Partial<Task>): Observable<Task> {
    return this.http.post<Envelope<Task>>(this.baseUrl, partial, { withCredentials: true }).pipe(
      map(r => r.data),
      tap(t => this._tasks.update(ts => [...ts, t])),
    );
  }

  updateTask(id: string, patch: Partial<Task>): Observable<Task> {
    return this.http.patch<Envelope<Task>>(`${this.baseUrl}/${id}`, patch, { withCredentials: true }).pipe(
      map(r => r.data),
      tap(t => this._applyTask(t)),
    );
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<Envelope<null>>(`${this.baseUrl}/${id}`, { withCredentials: true }).pipe(
      map(() => void 0),
      tap(() => this._tasks.update(ts => ts.filter(t => t.id !== id))),
    );
  }

  moveTask(id: string, column: TaskColumn): Observable<Task> {
    return this.http.patch<Envelope<Task>>(`${this.baseUrl}/${id}/move`, { column }, { withCredentials: true }).pipe(
      map(r => r.data),
      tap(t => this._applyTask(t)),
    );
  }

  /** TIMER — server enforces the one-running-timer invariant */
  startTimer(id: string): void {
    this.http.post<Envelope<StartTimerResult>>(
      `${this.baseUrl}/${id}/timer/start`, {}, { withCredentials: true }
    ).subscribe({
      next: r => {
        // Another task's timer was auto-stopped — refresh so its card updates too
        if (r.data.autoStopped) {
          this.refresh();
        } else {
          this._applyTask(r.data.task);
        }
        this.now.set(Date.now());
      },
      error: () => this.refresh(), // 409 ALREADY_RUNNING etc. — resync state
    });
  }

  stopTimer(id: string): void {
    this.http.post<Envelope<Task>>(
      `${this.baseUrl}/${id}/timer/stop`, {}, { withCredentials: true }
    ).subscribe({
      next: r => this._applyTask(r.data),
      error: () => this.refresh(),
    });
  }

  /** Restore the running timer's live chip on app load */
  getActiveTimer(): Observable<{ taskId: string; startedAt: number } | null> {
    return this.http.get<Envelope<{ taskId: string; startedAt: number } | null>>(
      `${this.baseUrl}/timer/active`, { withCredentials: true }
    ).pipe(map(r => r.data));
  }

  private _applyTask(updated: Task): void {
    this._tasks.update(ts => ts.map(t => t.id === updated.id ? updated : t));
  }
}
