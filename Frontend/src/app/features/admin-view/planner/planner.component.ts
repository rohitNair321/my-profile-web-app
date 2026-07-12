import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { TaskService } from 'src/app/core/services/task.service';
import { Task, TaskColumn, TaskPriority, isRunning } from './models/task.model';
import { TaskCardComponent } from './task-card/task-card.component';
import { TaskDetailDialogComponent } from './task-detail-dialog/task-detail-dialog.component';
import { TaskEditDialogComponent } from './task-edit-dialog/task-edit-dialog.component';

interface ColumnDef {
  id: TaskColumn;
  label: string;
  icon: string;
  color: string;
}

type PriorityFilter = 'all' | TaskPriority;

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [
    FormsModule,
    DragDropModule,
    TaskCardComponent,
    TaskDetailDialogComponent,
    TaskEditDialogComponent,
  ],
  templateUrl: './planner.component.html',
  styleUrls: ['./planner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannerComponent {
  private taskService = inject(TaskService);

  readonly columns: ColumnDef[] = [
    { id: 'todo', label: 'To Do',       icon: 'radio_button_unchecked', color: '#6366F1' },
    { id: 'prog', label: 'In Progress', icon: 'autorenew',              color: '#F59E0B' },
    { id: 'done', label: 'Done',        icon: 'check_circle',           color: '#10B981' },
  ];

  readonly allColIds = this.columns.map(c => c.id);

  readonly filters: Array<{ id: PriorityFilter; label: string }> = [
    { id: 'all',  label: 'All' },
    { id: 'high', label: 'High' },
    { id: 'med',  label: 'Med' },
    { id: 'low',  label: 'Low' },
  ];

  filter = signal<PriorityFilter>('all');

  // In-progress banner — the running-timer task, dismissible per task id
  private dismissedTaskId = signal<string | null>(null);
  inProgressBanner = computed(() => {
    const running = this.taskService.tasks().find(isRunning);
    if (!running || this.dismissedTaskId() === running.id) return null;
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const overdue = !!running.dueDate && running.dueDate < todayStr;
    return { taskId: running.id, title: running.title, overdue };
  });

  dismissBanner(): void {
    const b = this.inProgressBanner();
    if (b) this.dismissedTaskId.set(b.taskId);
  }

  private filtered = computed(() => {
    const f = this.filter();
    const tasks = this.taskService.tasks();
    return f === 'all' ? tasks : tasks.filter(t => t.priority === f);
  });

  todoTasks = computed(() => this.filtered().filter(t => t.column === 'todo'));
  progTasks = computed(() => this.filtered().filter(t => t.column === 'prog'));
  doneTasks = computed(() => this.filtered().filter(t => t.column === 'done'));

  // Quick add
  quickAddCol  = signal<TaskColumn | null>(null);
  quickAddText = '';

  // Detail dialog — track by id so the dialog re-renders as the task mutates
  private detailId = signal<string | null>(null);
  detailTask = computed(() =>
    this.taskService.tasks().find(t => t.id === this.detailId()) ?? null);

  // Edit dialog
  editOpen      = signal(false);
  editTask      = signal<Task | null>(null);
  editDefaultCol = signal<TaskColumn>('todo');

  tasksIn(col: TaskColumn): Task[] {
    switch (col) {
      case 'todo': return this.todoTasks();
      case 'prog': return this.progTasks();
      case 'done': return this.doneTasks();
    }
  }

  onDrop(e: CdkDragDrop<TaskColumn>): void {
    const task = e.item.data as Task;
    if (task.column !== e.container.data) {
      this.taskService.moveTask(task.id, e.container.data).subscribe();
    }
  }

  // ── Quick add ──────────────────────────────────────────────────

  openQuickAdd(col: TaskColumn): void {
    this.quickAddText = '';
    this.quickAddCol.set(col);
  }

  saveQuickAdd(): void {
    const title = this.quickAddText.trim();
    const col = this.quickAddCol();
    if (title && col) {
      this.taskService.addTask({ title, column: col }).subscribe();
    }
    this.cancelQuickAdd();
  }

  cancelQuickAdd(): void {
    this.quickAddCol.set(null);
    this.quickAddText = '';
  }

  // ── Dialogs ────────────────────────────────────────────────────

  openDetail(task: Task): void {
    this.detailId.set(task.id);
  }

  closeDetail(): void {
    this.detailId.set(null);
  }

  openNewTask(): void {
    this.editTask.set(null);
    this.editDefaultCol.set('todo');
    this.editOpen.set(true);
  }

  openEditFromDetail(): void {
    this.editTask.set(this.detailTask());
    this.detailId.set(null);
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.editTask.set(null);
  }
}
