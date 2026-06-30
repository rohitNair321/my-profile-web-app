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
  /** ISO string or null — the currently chosen value */
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

  private syncFromValue(): void {
    if (this.value) {
      const d = new Date(this.value);
      this.selDate = d;
      this.selHour = d.getHours();
      this.selMinute = d.getMinutes();
    } else {
      this.selDate = null;
      this.selHour = 9;
      this.selMinute = 0;
    }
  }

  get monthLabel(): string {
    return `${this.MONTHS[this.viewMonth]} ${this.viewYear}`;
  }

  get displayLabel(): string {
    if (!this.value) return '';
    return new Date(this.value).toLocaleString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  get hourStr(): string { return this.selHour.toString().padStart(2, '0'); }
  get minStr(): string { return this.selMinute.toString().padStart(2, '0'); }
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

  adjHour(delta: number): void {
    this.selHour = (this.selHour + delta + 24) % 24;
  }

  adjMin(delta: number): void {
    this.selMinute = Math.round(this.selMinute / 5) * 5;
    this.selMinute = (this.selMinute + delta * 5 + 60) % 60;
  }

  // ── Actions ─────────────────────────────────────────────────

  confirm(): void {
    if (!this.selDate) return;
    const d = new Date(this.selDate);
    d.setHours(this.selHour, this.selMinute, 0, 0);
    this.valueChange.emit(d.toISOString());
    this.close();
  }

  clear(): void {
    this.selDate = null;
    this.selHour = 9;
    this.selMinute = 0;
    this.valueChange.emit(null);
    this.close();
  }
}
