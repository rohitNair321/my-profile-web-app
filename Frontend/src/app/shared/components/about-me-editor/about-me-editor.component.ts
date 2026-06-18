import {
  Component,
  OnInit,
  Injector,
  signal,
  computed,
 ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonApp } from 'src/app/core/services/common';

// ── Field shape ───────────────────────────────────────────────
interface AboutFields {
  heading: string;
  role: string;
  location: string;
  shortBio: string;
  longBio: string;
}

const DEFAULTS: AboutFields = {
  heading: 'About Me',
  role: '',
  location: '',
  shortBio: '',
  longBio: '',
};

@Component({
  selector: 'app-about-me-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './about-me-editor.component.html',
  styleUrls: ['./about-me-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutMeEditorComponent extends CommonApp implements OnInit {

  // ── Field signals ─────────────────────────────────────────────
  heading = signal(DEFAULTS.heading);
  role = signal(DEFAULTS.role);
  location = signal(DEFAULTS.location);
  shortBio = signal(DEFAULTS.shortBio);
  longBio = signal(DEFAULTS.longBio);

  // ── Original snapshot for reset + dirty detection ─────────────
  original = signal<AboutFields>({ ...DEFAULTS });

  // ── UI state ──────────────────────────────────────────────────
  isLoading = signal(false);
  saving = signal(false);
  savedOk = signal(false);   // shows ✓ briefly after a successful save

  // ── Dirty: any field differs from its original ────────────────
  isDirty = computed(() => {
    const o = this.original();
    return this.heading() !== o.heading
      || this.role() !== o.role
      || this.location() !== o.location
      || this.shortBio() !== o.shortBio
      || this.longBio() !== o.longBio;
  });

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this._loadFromProfile();
  }

  // ── Update a single field ─────────────────────────────────────
  updateField(
    field: keyof AboutFields,
    value: string
  ): void {
    switch (field) {
      case 'heading': this.heading.set(value); break;
      case 'role': this.role.set(value); break;
      case 'location': this.location.set(value); break;
      case 'shortBio': this.shortBio.set(value); break;
      case 'longBio': this.longBio.set(value); break;
    }
    // Clear the "Saved" confirmation badge when the user edits again
    if (this.savedOk()) { this.savedOk.set(false); }
  }

  // ── Reset to last-saved snapshot ─────────────────────────────
  reset(): void {
    const o = this.original();
    this.heading.set(o.heading);
    this.role.set(o.role);
    this.location.set(o.location);
    this.shortBio.set(o.shortBio);
    this.longBio.set(o.longBio);
    this.savedOk.set(false);
  }

  // ── Save ──────────────────────────────────────────────────────
  save(): void {
    if (!this.isDirty() || this.saving()) { return; }

    const payload: AboutFields = {
      heading: this.heading(),
      role: this.role(),
      location: this.location(),
      shortBio: this.shortBio(),
      longBio: this.longBio(),
    };

    this.saving.set(true);

    // ── Wire your real API call here ─────────────────────────────
    // Example:
    // this.portfolioService.updateAboutMe(payload).subscribe({
    //   next: () => {
    //     this.original.set({ ...payload });
    //     this.saving.set(false);
    //     this.savedOk.set(true);
    //     setTimeout(() => this.savedOk.set(false), 2500);
    //   },
    //   error: () => {
    //     this.saving.set(false);
    //   },
    // });

    // ── Temporary stub (remove when API is wired) ─────────────
    setTimeout(() => {
      this.original.set({ ...payload });
      this.saving.set(false);
      this.savedOk.set(true);
      setTimeout(() => this.savedOk.set(false), 2500);
    }, 800);
  }

  // ── Private: seed from CommonApp profile signal ───────────────
  private _loadFromProfile(): void {
    this.isLoading.set(true);

    const seed = (profile: any) => {
      const fields: AboutFields = {
        heading: 'About Me',
        role: profile?.experiences?.find((e: any) => e.present)?.role ?? '',
        location: profile?.location ?? '',
        shortBio: '',           // not in current API — add when available
        longBio: profile?.description ?? '',
      };
      this.heading.set(fields.heading);
      this.role.set(fields.role);
      this.location.set(fields.location);
      this.shortBio.set(fields.shortBio);
      this.longBio.set(fields.longBio);
      this.original.set({ ...fields });
      this.isLoading.set(false);
    };

    const profile = this.appService.profile();
    if (profile) {
      seed(profile);
    } else {
      // Poll until appService loads the profile (max ~3 s)
      const interval = setInterval(() => {
        const p = this.appService.profile();
        if (p) { seed(p); clearInterval(interval); }
      }, 150);
      setTimeout(() => { clearInterval(interval); this.isLoading.set(false); }, 3000);
    }
  }
}