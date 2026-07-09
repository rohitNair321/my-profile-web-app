import { ChangeDetectionStrategy, Component, computed, Injector, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonApp } from 'src/app/core/services/common';
import { DateTimePickerComponent } from 'src/app/shared/components/ui/date-time-picker/date-time-picker.component';

interface ExperienceView {
  role:      string;
  company:   string;
  period:    string;
  current:   boolean;
  desc:      string;
  tech:      string[];
  projects:  string[];
  accent:    string;
  _srcIndex: number;
}

const ACCENT_CYCLE = ['#10B981', '#6366F1', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6'];

@Component({
  selector: 'app-admin-experience',
  standalone: true,
  imports: [FormsModule, DateTimePickerComponent],
  templateUrl: './experience.component.html',
  styleUrls: ['./experience.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminExperienceComponent extends CommonApp {
  showDialog   = signal(false);
  editingIdx   = signal(-1);  // -1 = new, >=0 = editing existing
  saving       = signal(false);
  deleteTarget = signal(-1);

  private rawExps = computed(() => this.appService.profile()?.experiences ?? []);

  items = computed<ExperienceView[]>(() =>
    this.rawExps().map((exp: any, i: number) => {
      const tech: string[] = (exp.projects ?? [])
        .flatMap((p: any) => p.technologies ?? [])
        .filter((t: string, idx: number, arr: string[]) => arr.indexOf(t) === idx);

      return {
        role:      exp.role        ?? '',
        company:   exp.company     ?? '',
        period:    this._period(exp.startDate, exp.endDate, exp.present),
        current:   !!exp.present,
        desc:      exp.description ?? '',
        tech,
        projects:  (exp.projects ?? []).map((p: any) => p.title ?? p.name ?? ''),
        accent:    ACCENT_CYCLE[i % ACCENT_CYCLE.length],
        _srcIndex: i,
      };
    })
  );

  // Dialog form fields
  dRole    = '';
  dCompany = '';
  dStart: string | null = null;
  dEnd:   string | null = null;
  dPresent = false;
  dDesc    = '';

  constructor(public override injector: Injector) {
    super(injector);
  }

  onDStartChange(iso: string | null): void {
    this.dStart = iso;
    // End can't precede the new start — clear a now-invalid end date.
    if (iso && this.dEnd && this.dEnd < iso) this.dEnd = null;
  }

  onDEndChange(iso: string | null): void { this.dEnd = iso; }

  // ── Dialog open ─────────────────────────────────────────────────────────────

  openAdd(): void {
    this.editingIdx.set(-1);
    this.dRole = this.dCompany = this.dDesc = '';
    this.dStart = this.dEnd = null;
    this.dPresent = false;
    this.showDialog.set(true);
  }

  openEdit(idx: number, ev: Event): void {
    ev.stopPropagation();
    const raw = this.rawExps()[idx];
    if (!raw) return;
    this.editingIdx.set(idx);
    this.dRole    = raw.role        ?? '';
    this.dCompany = raw.company     ?? '';
    this.dStart   = raw.startDate   ?? null;
    this.dEnd     = raw.endDate     ?? null;
    this.dPresent = !!raw.present;
    this.dDesc    = raw.description ?? '';
    this.showDialog.set(true);
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  save(): void {
    if (!this.dRole.trim() || !this.dCompany.trim()) return;
    const exps: any[] = JSON.parse(JSON.stringify(this.rawExps()));

    const entry = {
      role:        this.dRole.trim(),
      company:     this.dCompany.trim(),
      startDate:   this.dStart ?? undefined,
      endDate:     this.dPresent ? undefined : (this.dEnd ?? undefined),
      present:     this.dPresent,
      description: this.dDesc.trim(),
      projects:    exps[this.editingIdx()]?.projects ?? [],
    };

    if (this.editingIdx() >= 0) {
      exps[this.editingIdx()] = entry;
    } else {
      exps.unshift(entry);
    }

    this._persist(exps);
    this.showDialog.set(false);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  confirmDelete(idx: number, ev: Event): void {
    ev.stopPropagation();
    this.deleteTarget.set(idx);
  }

  doDelete(): void {
    const idx  = this.deleteTarget();
    const exps = JSON.parse(JSON.stringify(this.rawExps()));
    exps.splice(idx, 1);
    this._persist(exps);
    this.deleteTarget.set(-1);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private _persist(exps: any[]): void {
    this.saving.set(true);
    const fd = new FormData();
    fd.append('experiences', JSON.stringify(exps));
    this.saveWithFeedback(this.appService.updateProfile(fd), 'Experience saved').subscribe({
      next: () => this.saving.set(false),
      error: () => this.saving.set(false),
    });
  }

  private _period(start?: string, end?: string, present?: boolean): string {
    if (!start) return '';
    const s = this._fmtMonth(start);
    const e = present ? 'Present' : (end ? this._fmtMonth(end) : '');
    return e ? `${s} – ${e}` : s;
  }

  /** Formats 'YYYY-MM-DD' (new date picker) or legacy 'YYYY-MM' as "Mon YYYY". */
  private _fmtMonth(iso: string): string {
    const [y, m] = iso.split('-').map(Number);
    if (!y || !m) return iso;
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}
