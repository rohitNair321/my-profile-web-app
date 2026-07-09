import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaskService } from 'src/app/core/services/task.service';
import { DateTimePickerComponent } from 'src/app/shared/components/ui/date-time-picker/date-time-picker.component';
import { DurationPickerComponent } from 'src/app/shared/components/ui/duration-picker/duration-picker.component';
import { Task, TaskColumn, TaskPriority } from '../models/task.model';

@Component({
  selector: 'app-task-edit-dialog',
  standalone: true,
  imports: [FormsModule, DateTimePickerComponent, DurationPickerComponent],
  templateUrl: './task-edit-dialog.component.html',
  styleUrls: ['./task-edit-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskEditDialogComponent implements OnInit {
  /** null = create mode */
  task          = input<Task | null>(null);
  defaultColumn = input<TaskColumn>('todo');
  closed        = output<void>();

  private taskService = inject(TaskService);

  // Form state
  title        = '';
  description  = '';
  priority: TaskPriority = 'med';
  dueDate: string | null = null;
  estimateMin: number | null = null;
  tags         = signal<string[]>([]);
  tagInput     = '';
  column: TaskColumn = 'todo';

  error  = signal('');
  saving = signal(false);

  readonly priorities: Array<{ id: TaskPriority; label: string }> = [
    { id: 'low',  label: 'Low' },
    { id: 'med',  label: 'Med' },
    { id: 'high', label: 'High' },
  ];

  readonly columns: Array<{ id: TaskColumn; label: string }> = [
    { id: 'todo', label: 'To Do' },
    { id: 'prog', label: 'In Progress' },
    { id: 'done', label: 'Done' },
  ];

  get isEdit(): boolean { return this.task() !== null; }

  ngOnInit(): void {
    const t = this.task();
    this.column = this.defaultColumn();
    if (t) {
      this.title       = t.title;
      this.description = t.description;
      this.priority    = t.priority;
      this.dueDate     = t.dueDate ?? null;
      this.column      = t.column;
      this.estimateMin = t.estimateMin;
      this.tags.set([...t.tags]);
    }
  }

  onDueDateChange(iso: string | null): void { this.dueDate = iso; }
  onEstimateChange(mins: number | null): void { this.estimateMin = mins; }

  addTag(e: Event): void {
    e.preventDefault();
    const tag = this.tagInput.trim();
    if (tag && !this.tags().includes(tag) && this.tags().length < 10) {
      this.tags.update(ts => [...ts, tag]);
    }
    this.tagInput = '';
  }

  removeTag(tag: string): void {
    this.tags.update(ts => ts.filter(t => t !== tag));
  }

  save(): void {
    this.error.set('');
    const title = this.title.trim();
    if (!title) { this.error.set('Title is required.'); return; }

    const payload: Partial<Task> = {
      title,
      description: this.description.trim(),
      priority:    this.priority,
      dueDate:     this.dueDate || null,
      tags:        this.tags(),
      column:      this.column,
      estimateMin: this.estimateMin,
    };

    this.saving.set(true);
    const req = this.isEdit
      ? this.taskService.updateTask(this.task()!.id, payload)
      : this.taskService.addTask(payload as Pick<Task, 'title' | 'column'> & Partial<Task>);

    req.subscribe({
      next:  () => { this.saving.set(false); this.closed.emit(); },
      error: () => { this.saving.set(false); this.error.set('Failed to save task.'); },
    });
  }
}
