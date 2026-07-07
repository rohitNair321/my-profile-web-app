import { ChangeDetectionStrategy, Component, computed, effect, Injector, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, tap } from 'rxjs';
import { CommonApp } from 'src/app/core/services/common';
import { AdminDirtyComponent } from 'src/app/core/app-gards/unsaved-changes.guard';
import { splitTokens, mergeTokens } from 'src/app/shared/utils/split-tokens';

interface ThemeRow { name: string; c1: string; c2: string; c3: string; active: boolean; }

type Tab = 'info' | 'bio' | 'resume';

@Component({
  selector: 'app-admin-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProfileComponent extends CommonApp implements AdminDirtyComponent {
  profile = computed(() => this.appService.profile());

  // Mini theme widget in the sidebar
  themes = computed<ThemeRow[]>(() => {
    const p = this.appService.profile();
    const current = p?.currenttheme ?? '';
    return (p?.themes ?? []).map((t: any) => ({
      name:   t.name ?? t.id ?? '',
      c1:     t.tokens?.primary    ?? '#10B981',
      c2:     t.tokens?.accent     ?? '#06B6D4',
      c3:     t.tokens?.background ?? '#0F172A',
      active: (t.name ?? t.id) === current,
    }));
  });

  activeTab  = signal<Tab>('info');
  saving     = signal(false);
  savedOk    = signal(false);
  avatarSrc  = signal<string | null>(null);
  avatarFile: File | null = null;

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'info',   label: 'Personal Info'    },
    { id: 'bio',    label: 'Bio / Description' },
    { id: 'resume', label: 'Resume'            },
  ];

  // Form fields — all plain strings so ngModel binds directly
  fullName  = '';
  jobTitle  = '';
  email     = '';
  phone     = '';
  secondaryPhone = '';
  location  = '';
  website   = '';
  github    = '';
  linkedin  = '';
  bio       = '';
  shortBio  = '';
  skills:   string[] = [];
  newSkill    = '';
  addingSkill = signal(false);

  private _seeded = false;
  // Snapshot of the last-saved form state for dirty detection
  private _baseline = '';

  constructor(public override injector: Injector) {
    super(injector);

    // Seed form fields once when profile is first available.
    // Uses an effect so it works whether profile loads before or after construction.
    effect(() => {
      const p = this.appService.profile();
      if (p && !this._seeded) {
        this._seeded = true;
        this._seed(p);
      }
    });
  }

  private _seed(p: any): void {
    this.fullName       = p.full_name      ?? '';
    this.jobTitle       = p.about_role     ?? p.experiences?.find((e: any) => e.present)?.role ?? '';
    this.email          = p.email          ?? '';
    this.phone          = p.primary_phone  ?? '';
    this.secondaryPhone = p.secondary_phone ?? '';
    this.location       = p.location       ?? '';
    this.website        = p.website        ?? '';
    this.github         = p.github         ?? '';
    this.linkedin       = p.linkedin       ?? '';
    this.bio            = p.description    ?? '';
    this.shortBio       = p.short_bio      ?? '';
    this.skills         = p.skills?.length ? [...p.skills] : [];
    this.avatarSrc.set(p.avatar_url ?? null);
    this.avatarFile = null;
    this._baseline = this._snapshot();
  }

  /** Serializable snapshot of all editable fields for dirty comparison */
  private _snapshot(): string {
    return JSON.stringify([
      this.fullName, this.jobTitle, this.email, this.phone, this.secondaryPhone,
      this.location, this.website, this.github, this.linkedin, this.bio, this.shortBio,
      this.skills, this.avatarFile?.name ?? '',
    ]);
  }

  // ── AdminDirtyComponent (unsaved-changes guard) ──────────────────
  isDirty(): boolean {
    return this._seeded && this._snapshot() !== this._baseline;
  }

  discardChanges(): void {
    const p = this.appService.profile();
    if (p) this._seed(p);
  }

  onAvatarChange(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.avatarFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => this.avatarSrc.set((ev.target?.result as string) ?? null);
    reader.readAsDataURL(file);
  }

  get initials(): string {
    const parts = (this.fullName || 'RN').split(' ');
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }

  switchTab(id: Tab): void { this.activeTab.set(id); }

  removeSkill(i: number): void {
    this.skills = this.skills.filter((_, idx) => idx !== i);
  }

  confirmAddSkill(): void {
    // Accepts a single skill OR a pasted bundle ("Angular, TypeScript, RxJS")
    const incoming = splitTokens(this.newSkill);
    if (incoming.length) {
      this.skills = mergeTokens(this.skills, incoming, { maxLen: 40 }).list;
    }
    this.newSkill = '';
    this.addingSkill.set(false);
  }

  activateTheme(idx: number): void {
    const t = this.themes()[idx];
    if (!t) return;
    const fd = new FormData();
    fd.append('currenttheme', t.name);
    this.saveWithFeedback(this.appService.updateProfile(fd), 'Theme activated').subscribe();
  }

  private _buildFormData(): FormData {
    const fd = new FormData();
    fd.append('full_name',       this.fullName.trim());
    fd.append('about_role',      this.jobTitle.trim());
    fd.append('email',           this.email.trim());
    fd.append('primaryPhone',    this.phone.trim());
    fd.append('secondaryPhone',  this.secondaryPhone.trim());
    fd.append('location',        this.location.trim());
    fd.append('website',         this.website.trim());
    fd.append('github',          this.github.trim());
    fd.append('linkedin',        this.linkedin.trim());
    fd.append('description',     this.bio.trim());
    fd.append('short_bio',       this.shortBio.trim());
    fd.append('skills',          JSON.stringify(this.skills));
    if (this.avatarFile) {
      fd.append('avatar', this.avatarFile, this.avatarFile.name);
    }
    return fd;
  }

  /** AdminDirtyComponent — used by both the Save button and the route guard */
  saveChanges(): Observable<any> {
    return this.saveWithFeedback(
      this.appService.updateProfile(this._buildFormData()),
      'Profile saved successfully'
    ).pipe(
      tap(() => {
        this.avatarFile = null;
        this._baseline = this._snapshot();
      })
    );
  }

  onSave(): void {
    if (!this.isDirty() || this.saving()) return;
    this.saving.set(true);
    this.saveChanges().subscribe({
      next:  () => { this.saving.set(false); this.savedOk.set(true); setTimeout(() => this.savedOk.set(false), 2500); },
      error: () => this.saving.set(false),
    });
  }
}
