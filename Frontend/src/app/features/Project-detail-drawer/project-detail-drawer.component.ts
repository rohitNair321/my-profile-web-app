import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  HostListener,
  signal,
  computed,
 ChangeDetectionStrategy } from '@angular/core';
import { NgClass as NgClassDirective } from '@angular/common';

// Re-export types from projects-page so they share one source of truth.
// If you move types to a shared models file, update this import path.
import { ProjectItem } from '../projects-page/projects-page.component';

@Component({
  selector: 'app-project-detail-drawer',
  standalone: true,
  imports: [NgClassDirective],
  templateUrl: './project-detail-drawer.component.html',
  styleUrls: ['./project-detail-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectDetailDrawerComponent implements OnChanges, OnDestroy {

  // ── Inputs ────────────────────────────────────────────────────

  /** The project item currently being shown. Null = drawer closed. */
  @Input() selectedItem: ProjectItem | null = null;

  /**
   * All projects in display order.
   * Passed from the parent so prev/next navigation works across the full list.
   */
  @Input() allItems: ProjectItem[] = [];

  // ── Output ────────────────────────────────────────────────────

  /** Emitted when the user closes the drawer. Parent sets selectedItem = null. */
  @Output() closed = new EventEmitter<void>();

  // ── Internal signals ──────────────────────────────────────────

  /** Index of the currently displayed item within allItems. */
  private currentIndex = signal<number>(0);

  /** Whether the drawer is visible. */
  isOpen = signal(false);

  /** Reactive reference to the current project item. */
  item = computed<ProjectItem | null>(() => {
    const idx = this.currentIndex();
    return this.allItems[idx] ?? null;
  });

  // ── Navigation ────────────────────────────────────────────────

  hasPrev = computed(() => this.currentIndex() > 0);
  hasNext = computed(() => this.currentIndex() < this.allItems.length - 1);

  prev(): void {
    if (this.hasPrev()) {
      this.currentIndex.update(i => i - 1);
      this._scrollBodyToTop();
    }
  }

  next(): void {
    if (this.hasNext()) {
      this.currentIndex.update(i => i + 1);
      this._scrollBodyToTop();
    }
  }

  // ── Derived display values ────────────────────────────────────

  period = computed<string>(() => {
    const exp = this.item()?.experience;
    if (!exp) { return ''; }
    return this._formatPeriod(exp.startDate ?? '', exp.endDate ?? '', exp.present ?? false);
  });

  // ── Lifecycle ─────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedItem']) {
      const item = this.selectedItem;
      if (item) {
        // Find the index in allItems so prev/next work correctly
        const idx = this.allItems.findIndex(
          i => i.project.title === item.project.title
            && i.experience.company === item.experience.company
        );
        this.currentIndex.set(idx >= 0 ? idx : 0);
        this.isOpen.set(true);
        this._lockBodyScroll(true);
      } else {
        this.isOpen.set(false);
        this._lockBodyScroll(false);
      }
    }
  }

  ngOnDestroy(): void {
    this._lockBodyScroll(false);
  }

  // ── Close ─────────────────────────────────────────────────────

  close(): void {
    this.isOpen.set(false);
    this._lockBodyScroll(false);
    this.closed.emit();
  }

  /** Close on Escape key. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) { this.close(); }
  }

  // ── Template helpers ──────────────────────────────────────────

  techClass(tech: string): string {
    return tech.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  }

  // ── Private ───────────────────────────────────────────────────

  private _formatPeriod(start: string, end: string, present: boolean): string {
    const fmt = (ym: string): string => {
      if (!ym) { return ''; }
      const [y, m] = ym.split('-');
      const date = new Date(+y, +m - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };
    const s = fmt(start);
    const e = present ? 'Present' : fmt(end);
    return e ? `${s} – ${e}` : s;
  }

  /** Prevent the page body from scrolling while the drawer is open. */
  private _lockBodyScroll(lock: boolean): void {
    if (typeof document === 'undefined') { return; }
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  /** Scroll the drawer body back to the top when navigating between projects. */
  private _scrollBodyToTop(): void {
    setTimeout(() => {
      const el = document.querySelector('.pd__body');
      if (el) { el.scrollTop = 0; }
    }, 30);
  }
}