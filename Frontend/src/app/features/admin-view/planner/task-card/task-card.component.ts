import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TaskService } from 'src/app/core/services/task.service';
import {
  Task, TaskPriority, isRunning, roundedTime, timerProgress, totalWorkedMs,
} from '../models/task.model';

const PR_COLORS: Record<TaskPriority, string> = {
  high: '#EF4444',
  med:  '#F59E0B',
  low:  '#10B981',
};

const PR_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  med:  'Med',
  low:  'Low',
};

const PR_CYCLE: Record<TaskPriority, TaskPriority> = {
  low: 'med', med: 'high', high: 'low',
};

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './task-card.component.html',
  styleUrls: ['./task-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCardComponent {
  task = input.required<Task>();
  open = output<void>();

  private taskService = inject(TaskService);

  running  = computed(() => isRunning(this.task()));
  workedMs = computed(() => totalWorkedMs(this.task(), this.taskService.now()));
  rounded  = computed(() => roundedTime(this.task(), this.taskService.now()));
  progress = computed(() => timerProgress(this.task(), this.taskService.now()));

  prColor = computed(() => PR_COLORS[this.task().priority]);
  prLabel = computed(() => PR_LABELS[this.task().priority]);

  /** Live MM:SS (or H:MM:SS past an hour) */
  liveClock = computed(() => {
    const s = Math.floor(this.workedMs() / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  });

  toggleTimer(e: Event): void {
    e.stopPropagation();
    this.running()
      ? this.taskService.stopTimer(this.task().id)
      : this.taskService.startTimer(this.task().id);
  }

  cyclePriority(e: Event): void {
    e.stopPropagation();
    this.taskService.updateTask(this.task().id, {
      priority: PR_CYCLE[this.task().priority],
    }).subscribe();
  }

  remove(e: Event): void {
    e.stopPropagation();
    this.taskService.deleteTask(this.task().id).subscribe();
  }
}
