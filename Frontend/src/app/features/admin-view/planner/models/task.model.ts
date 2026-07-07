export type TaskColumn   = 'todo' | 'prog' | 'done';
export type TaskPriority = 'low' | 'med' | 'high';

export interface TaskTimeLog {
  startedAt: number;        // epoch ms
  stoppedAt: number | null; // null = currently running
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;   // ISO date 'YYYY-MM-DD'
  tags: string[];
  column: TaskColumn;
  estimateMin: number | null;
  timeLogs: TaskTimeLog[];
  createdAt: number;
  updatedAt: number;
}

/** Total worked ms — closed logs + live current log */
export function totalWorkedMs(t: Task, now = Date.now()): number {
  return t.timeLogs.reduce((sum, log) =>
    sum + ((log.stoppedAt ?? now) - log.startedAt), 0);
}

/** Is the timer currently running? */
export function isRunning(t: Task): boolean {
  return t.timeLogs.some(l => l.stoppedAt === null);
}

/** Rounded display: round to nearest 15 min — 47m → "45m", 1h 22m → "1h 15m" */
export function roundedTime(t: Task, now = Date.now()): string {
  const min = Math.round(totalWorkedMs(t, now) / 60000 / 15) * 15;
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Progress 0–1 against estimate (for the card progress bar) */
export function timerProgress(t: Task, now = Date.now()): number | null {
  if (!t.estimateMin) return null;
  return Math.min(1, totalWorkedMs(t, now) / 60000 / t.estimateMin);
}
