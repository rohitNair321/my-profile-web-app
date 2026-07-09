import {
  Component, ElementRef, EventEmitter, HostListener,
  Input, OnChanges, Output, SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface CalDay {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  disabled: boolean;
}

@Component({
  selector: 'app-date-time-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-time-picker.component.html',
  styleUrls: ['./date-time-picker.component.scss'],
})
export class DateTimePickerComponent implements OnChanges {
  /**
   * 'datetime' (default) — full ISO datetime in/out, shows the hour/minute steppers.
   * 'date'     — date-only 'YYYY-MM-DD' in/out (no timezone conversion), hides
   *              the time steppers. Used for due dates (Planner) vs. scheduling
   *              (post editor), which is why this is a mode rather than a
   *              separate component — one picker, two use cases.
   */
  @Input() mode: 'date' | 'datetime' = 'datetime';
  /** ISO string (or 'YYYY-MM-DD' in date mode) or null — the currently chosen value */
  @Input() value: string | null = null;
  /** ISO string — earliest selectable date/time */
  @Input() min: string | null = null;
  @Input() placeholder = 'Pick date & time';

  @Output() valueChange = new EventEmitter<string | null>();

  open = false;
  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth(); // 0-based

  selDate: Date | null = null;
  selHour = 9;
  selMinute = 0;
  selSecond = 0;
  days: CalDay[] = [];

  readonly WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  readonly MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  constructor(private elRef: ElementRef) {}

  ngOnChanges(c: SimpleChanges): void {
    if (c['value']) this.syncFromValue();
  }

  /** Parse 'YYYY-MM-DD' as a LOCAL midnight Date — `new Date(str)` parses it as
   *  UTC midnight, which can display as the previous day in negative UTC-offset
   *  timezones. Only relevant in 'date' mode. */
  private parseDateOnly(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private syncFromValue(): void {
    if (this.value) {
      const d = this.mode === 'date' ? this.parseDateOnly(this.value) : new Date(this.value);
      this.selDate = d;
      this.selHour = this.mode === 'date' ? 9 : d.getHours();
      this.selMinute = this.mode === 'date' ? 0 : d.getMinutes();
      this.selSecond = this.mode === 'date' ? 0 : d.getSeconds();
    } else {
      this.selDate = null;
      this.selHour = 9;
      this.selMinute = 0;
      this.selSecond = 0;
    }
  }

  get monthLabel(): string {
    return `${this.MONTHS[this.viewMonth]} ${this.viewYear}`;
  }

  get displayLabel(): string {
    if (!this.value) return '';
    if (this.mode === 'date') {
      return this.parseDateOnly(this.value).toLocaleDateString('en-US', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    }
    return new Date(this.value).toLocaleString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  get hourStr(): string { return this.selHour.toString().padStart(2, '0'); }
  get minStr(): string { return this.selMinute.toString().padStart(2, '0'); }
  get secStr(): string { return this.selSecond.toString().padStart(2, '0'); }
  get isPm(): boolean { return this.selHour >= 12; }

  // ── Open / close ────────────────────────────────────────────

  toggle(): void {
    this.open = !this.open;
    if (this.open) {
      const ref = this.selDate ?? new Date();
      this.viewYear = ref.getFullYear();
      this.viewMonth = ref.getMonth();
      this.buildCalendar();
    }
  }

  close(): void { this.open = false; }

  @HostListener('document:click', ['$event'])
  onOutsideClick(e: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(e.target)) this.close();
  }

  // ── Month navigation ────────────────────────────────────────

  prevMonth(): void {
    if (this.viewMonth === 0) { this.viewMonth = 11; this.viewYear--; }
    else this.viewMonth--;
    this.buildCalendar();
  }

  nextMonth(): void {
    if (this.viewMonth === 11) { this.viewMonth = 0; this.viewYear++; }
    else this.viewMonth++;
    this.buildCalendar();
  }

  // ── Calendar grid ───────────────────────────────────────────

  buildCalendar(): void {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const minD = this.min ? new Date(this.min) : null;
    if (minD) minD.setHours(0, 0, 0, 0);

    const first = new Date(this.viewYear, this.viewMonth, 1);
    const last  = new Date(this.viewYear, this.viewMonth + 1, 0);
    const out: CalDay[] = [];

    for (let i = 0; i < first.getDay(); i++) {
      out.push(this.mkDay(new Date(this.viewYear, this.viewMonth, i - first.getDay() + 1), false, today, minD));
    }
    for (let d = 1; d <= last.getDate(); d++) {
      out.push(this.mkDay(new Date(this.viewYear, this.viewMonth, d), true, today, minD));
    }
    let i = 1;
    while (out.length < 42) {
      out.push(this.mkDay(new Date(this.viewYear, this.viewMonth + 1, i++), false, today, minD));
    }
    this.days = out;
  }

  private mkDay(date: Date, inMonth: boolean, today: Date, minD: Date | null): CalDay {
    const norm = new Date(date); norm.setHours(0, 0, 0, 0);
    const selN = this.selDate ? new Date(this.selDate) : null;
    if (selN) selN.setHours(0, 0, 0, 0);
    return {
      date,
      inMonth,
      isToday:    norm.getTime() === today.getTime(),
      isSelected: selN ? norm.getTime() === selN.getTime() : false,
      disabled:   minD ? norm < minD : false,
    };
  }

  pickDay(day: CalDay): void {
    if (day.disabled) return;
    this.selDate = new Date(day.date);
    this.buildCalendar();
  }

  // ── Time controls ───────────────────────────────────────────
  // Steppers move by 1 unit (not 5) so any exact value is reachable; the
  // typed inputs below let a value be set directly without clicking at all.

  adjHour(delta: number): void {
    this.selHour = (this.selHour + delta + 24) % 24;
  }

  adjMin(delta: number): void {
    this.selMinute = (this.selMinute + delta + 60) % 60;
  }

  adjSec(delta: number): void {
    this.selSecond = (this.selSecond + delta + 60) % 60;
  }

  onHourInput(e: Event): void {
    const n = parseInt((e.target as HTMLInputElement).value, 10);
    this.selHour = Number.isNaN(n) ? this.selHour : ((n % 24) + 24) % 24;
  }

  onMinuteInput(e: Event): void {
    const n = parseInt((e.target as HTMLInputElement).value, 10);
    this.selMinute = Number.isNaN(n) ? this.selMinute : ((n % 60) + 60) % 60;
  }

  onSecondInput(e: Event): void {
    const n = parseInt((e.target as HTMLInputElement).value, 10);
    this.selSecond = Number.isNaN(n) ? this.selSecond : ((n % 60) + 60) % 60;
  }

  selectInputText(e: Event): void {
    (e.target as HTMLInputElement).select();
  }

  // ── Actions ─────────────────────────────────────────────────

  confirm(): void {
    if (!this.selDate) return;
    if (this.mode === 'date') {
      const y = this.selDate.getFullYear();
      const m = String(this.selDate.getMonth() + 1).padStart(2, '0');
      const d = String(this.selDate.getDate()).padStart(2, '0');
      this.valueChange.emit(`${y}-${m}-${d}`);
    } else {
      const d = new Date(this.selDate);
      d.setHours(this.selHour, this.selMinute, this.selSecond, 0);
      this.valueChange.emit(d.toISOString());
    }
    this.close();
  }

  clear(): void {
    this.selDate = null;
    this.selHour = 9;
    this.selMinute = 0;
    this.selSecond = 0;
    this.valueChange.emit(null);
    this.close();
  }
}
