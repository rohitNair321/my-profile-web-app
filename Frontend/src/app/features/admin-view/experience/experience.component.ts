import { ChangeDetectionStrategy, Component, computed, Injector, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonApp } from 'src/app/core/services/common';

interface ExperienceView {
  role:      string;
  company:   string;
  period:    string;
  current:   boolean;
  desc:      string;
  tech:      string[];
  projects:  string[];
  _srcIndex: number;
}

@Component({
  selector: 'app-admin-experience',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './experience.component.html',
  styleUrls: ['./experience.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminExperienceComponent extends CommonApp {
  showDialog   = signal(false);
  editingIdx   = signal(-1);  // -1 = new, >=0 = editing existing
  saving       = signal(false);
  deleteTarget = signal(-1);

  openStates = signal<Record<number, boolean>>({ 0: true });

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
        _srcIndex: i,
      };
    })
  );

  // Dialog form fields
  dRole    = '';
  dCompany = '';
  dStart   = '';
  dEnd     = '';
  dPresent = false;
  dDesc    = '';

  constructor(public override injector: Injector) {
    super(injector);
  }

  isOpen(idx: number): boolean {
    const s = this.openStates();
    return idx in s ? s[idx] : idx === 0;
  }

  toggleItem(idx: number): void {
    this.openStates.update(s => ({ ...s, [idx]: !this.isOpen(idx) }));
  }

  // ── Dialog open ─────────────────────────────────────────────────────────────

  openAdd(): void {
    this.editingIdx.set(-1);
    this.dRole = this.dCompany = this.dStart = this.dEnd = this.dDesc = '';
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
    this.dStart   = raw.startDate   ?? '';
    this.dEnd     = raw.endDate     ?? '';
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
      startDate:   this.dStart || undefined,
      endDate:     this.dPresent ? undefined : (this.dEnd || undefined),
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
    this.appService.updateProfile(fd).subscribe({
      next: () => this.saving.set(false),
      error: () => this.saving.set(false),
    });
  }

  private _period(start?: string, end?: string, present?: boolean): string {
    if (!start) return '';
    const e = present ? 'Present' : (end ?? '');
    return e ? `${start} – ${e}` : start;
  }
}
