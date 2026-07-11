import {
  Component, ElementRef, EventEmitter, HostListener,
  Input, OnChanges, OnDestroy, Output, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable duration/estimate picker — quick-pick chips + hour/minute steppers,
 * matching the visual language of DateTimePickerComponent (shared design system:
 * same trigger/popover/footer shapes, spacing scale, type scale). Value is
 * always minutes in/out so it's easy to bind anywhere durations are tracked
 * (Planner task estimates today; any future timer/estimate field reuses this
 * instead of a raw number input + unit dropdown).
 */
@Component({
  selector: 'app-duration-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './duration-picker.component.html',
  styleUrls: ['./duration-picker.component.scss'],
})
export class DurationPickerComponent implements OnChanges, OnDestroy {
  /** Duration in minutes, or null for "not set" */
  @Input() value: number | null = null;
  @Input() placeholder = 'Set duration';
  /** Upper bound safety net (minutes). Default 100000 matches backend cap. */
  @Input() max = 100000;

  @Output() valueChange = new EventEmitter<number | null>();

  open = false;
  hours = 0;
  minutes = 0;

  readonly QUICK_PICKS = [15, 30, 45, 60, 90, 120, 180, 240];

  constructor(private elRef: ElementRef) {}

  ngOnChanges(c: SimpleChanges): void {
    if (c['value']) this.syncFromValue();
  }

  private syncFromValue(): void {
    const v = this.value ?? 0;
    this.hours = Math.floor(v / 60);
    this.minutes = v % 60;
  }

  get displayLabel(): string {
    if (!this.value) return '';
    const h = Math.floor(this.value / 60);
    const m = this.value % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  quickLabel(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const h = mins / 60;
    return Number.isInteger(h) ? `${h}h` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  isQuickActive(mins: number): boolean {
    return this.value === mins;
  }

  // ── Open / close ────────────────────────────────────────────

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      this.syncFromValue();
      this.attachReposition();
    } else {
      this.detachReposition();
    }
  }

  close(): void {
    this.open = false;
    this.detachReposition();
  }

  ngOnDestroy(): void { this.detachReposition(); }

  @HostListener('document:click', ['$event'])
  onOutsideClick(e: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(e.target)) this.close();
  }

  // ── Popover positioning ─────────────────────────────────────
  // Anchored with `position: fixed` + measured coordinates so it escapes the
  // dialog's `overflow-y:auto` scroll box (otherwise the popover — including the
  // Confirm button — is clipped inside the modal). See DateTimePicker for the
  // containing-block rationale; kept in sync between the two pickers.

  private readonly repositionFn = () => this.reposition();

  private attachReposition(): void {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => this.reposition());
    window.addEventListener('scroll', this.repositionFn, true);
    window.addEventListener('resize', this.repositionFn);
  }

  private detachReposition(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('scroll', this.repositionFn, true);
    window.removeEventListener('resize', this.repositionFn);
  }

  private reposition(): void {
    if (!this.open) return;
    const host = this.elRef.nativeElement as HTMLElement;
    const trigger = host.querySelector('.durp__trigger-row') as HTMLElement | null;
    const pop = host.querySelector('.durp__popover') as HTMLElement | null;
    if (!trigger || !pop) return;

    pop.style.position = 'fixed';
    pop.style.margin = '0';
    pop.style.top = '0';
    pop.style.left = '0';
    const origin = pop.getBoundingClientRect();

    const tr = trigger.getBoundingClientRect();
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;

    let top = tr.bottom + gap;
    if (top + ph > vh - gap) {
      const above = tr.top - gap - ph;
      top = above >= gap ? above : Math.max(gap, vh - ph - gap);
    }
    let left = tr.left;
    if (left + pw > vw - gap) left = vw - pw - gap;
    if (left < gap) left = gap;

    pop.style.top = `${Math.round(top - origin.top)}px`;
    pop.style.left = `${Math.round(left - origin.left)}px`;
  }

  // ── Steppers ────────────────────────────────────────────────

  adjHours(delta: number): void {
    const totalMax = Math.floor(this.max / 60);
    this.hours = Math.min(totalMax, Math.max(0, this.hours + delta));
  }

  adjMinutes(delta: number): void {
    let next = this.minutes + delta;
    if (next >= 60) { next -= 60; this.adjHours(1); }
    else if (next < 0) { next += 60; this.adjHours(-1); }
    this.minutes = next;
  }

  get hourStr(): string { return String(this.hours).padStart(2, '0'); }
  get minStr(): string { return String(this.minutes).padStart(2, '0'); }

  /** Human total for the live preview under the custom fields. */
  get customPreview(): string {
    const total = this.hours * 60 + this.minutes;
    if (total <= 0) return 'No estimate';
    if (this.hours === 0) return `${this.minutes}m`;
    if (this.minutes === 0) return `${this.hours}h`;
    return `${this.hours}h ${this.minutes}m`;
  }

  onHoursInput(e: Event): void {
    const n = parseInt((e.target as HTMLInputElement).value, 10);
    if (Number.isNaN(n)) return;
    const totalMax = Math.floor(this.max / 60);
    this.hours = Math.min(totalMax, Math.max(0, n));
  }

  onMinutesInput(e: Event): void {
    const n = parseInt((e.target as HTMLInputElement).value, 10);
    if (Number.isNaN(n)) return;
    this.minutes = ((n % 60) + 60) % 60;
  }

  selectInputText(e: Event): void {
    (e.target as HTMLInputElement).select();
  }

  // ── Actions ─────────────────────────────────────────────────

  pickQuick(mins: number): void {
    this.valueChange.emit(mins);
    this.close();
  }

  confirmCustom(): void {
    const total = Math.min(this.max, this.hours * 60 + this.minutes);
    this.valueChange.emit(total > 0 ? total : null);
    this.close();
  }

  clear(): void {
    this.hours = 0;
    this.minutes = 0;
    this.valueChange.emit(null);
    this.close();
  }
}
