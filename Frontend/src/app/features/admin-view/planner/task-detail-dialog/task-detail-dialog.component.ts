import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TaskService } from 'src/app/core/services/task.service';
import {
  Task, TaskColumn, TaskTimeLog, isRunning, roundedTime, timerProgress, totalWorkedMs,
} from '../models/task.model';

const PR_COLORS: Record<string, string> = { high: '#EF4444', med: '#F59E0B', low: '#10B981' };
const PR_LABELS: Record<string, string> = { high: 'High', med: 'Med', low: 'Low' };

@Component({
  selector: 'app-task-detail-dialog',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './task-detail-dialog.component.html',
  styleUrls: ['./task-detail-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetailDialogComponent {
  task   = input.required<Task>();
  closed = output<void>();
  edit   = output<void>();

  private taskService = inject(TaskService);

  readonly columns: Array<{ id: TaskColumn; label: string }> = [
    { id: 'todo', label: 'To Do' },
    { id: 'prog', label: 'In Progress' },
    { id: 'done', label: 'Done' },
  ];

  running  = computed(() => isRunning(this.task()));
  workedMs = computed(() => totalWorkedMs(this.task(), this.taskService.now()));
  rounded  = computed(() => roundedTime(this.task(), this.taskService.now()));
  progress = computed(() => timerProgress(this.task(), this.taskService.now()));

  prColor = computed(() => PR_COLORS[this.task().priority]);
  prLabel = computed(() => PR_LABELS[this.task().priority]);

  /** Reversed session log — newest first */
  logs = computed(() => this.task().timeLogs.slice().reverse());

  liveClock = computed(() => {
    const s = Math.floor(this.workedMs() / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  });

  /** Raw exact time, e.g. "2h 08m 32s" */
  rawTime = computed(() => this._fmtDuration(this.workedMs()));

  estimateLabel = computed(() => {
    const est = this.task().estimateMin;
    if (!est) return '';
    if (est < 60) return `${est}m`;
    const h = Math.floor(est / 60), m = est % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  });

  pct = computed(() => {
    const p = this.progress();
    return p === null ? 0 : Math.round(p * 100);
  });

  logDuration(log: TaskTimeLog): string {
    const end = log.stoppedAt ?? this.taskService.now();
    return this._fmtDuration(end - log.startedAt);
  }

  toggleTimer(): void {
    this.running()
      ? this.taskService.stopTimer(this.task().id)
      : this.taskService.startTimer(this.task().id);
  }

  moveTo(column: TaskColumn): void {
    this.taskService.moveTask(this.task().id, column).subscribe();
  }

  deleteTask(): void {
    this.taskService.deleteTask(this.task().id).subscribe(() => this.closed.emit());
  }

  private _fmtDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
    if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
    return `${sec}s`;
  }
}
