import {
  Component, ElementRef, EventEmitter, HostListener,
  Input, OnChanges, Output, SimpleChanges,
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
export class DurationPickerComponent implements OnChanges {
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
    if (this.open) this.syncFromValue();
  }

  close(): void { this.open = false; }

  @HostListener('document:click', ['$event'])
  onOutsideClick(e: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(e.target)) this.close();
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
