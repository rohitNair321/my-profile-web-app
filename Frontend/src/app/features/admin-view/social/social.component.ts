import { ChangeDetectionStrategy, Component, Injector, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, tap } from 'rxjs';
import { CommonApp } from 'src/app/core/services/common';
import { AdminDirtyComponent } from 'src/app/core/app-gards/unsaved-changes.guard';

interface SocialLink {
  platform: string; icon: string; handle: string;
  color: string; bgColor: string; enabled: boolean;
  fieldKey?: string; // profile field that maps to this platform
}

@Component({
  selector: 'app-admin-social',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './social.component.html',
  styleUrls: ['./social.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSocialComponent extends CommonApp implements OnInit, AdminDirtyComponent {
  saved = signal(false);
  saving = signal(false);
  private _baseline = '';

  // Platform list — GitHub/LinkedIn/Website are populated from profile
  socials: SocialLink[] = [
    { platform: 'GitHub',    icon: 'code',            handle: '', color: '#E2E8F0', bgColor: '#24292E',             enabled: true,  fieldKey: 'github'   },
    { platform: 'LinkedIn',  icon: 'business',        handle: '', color: '#0A66C2', bgColor: 'rgba(10,102,194,.12)', enabled: true,  fieldKey: 'linkedin' },
    { platform: 'Website',   icon: 'language',        handle: '', color: '#10B981', bgColor: 'rgba(16,185,129,.12)', enabled: true,  fieldKey: 'website'  },
    { platform: 'Twitter/X', icon: 'alternate_email', handle: '', color: '#1DA1F2', bgColor: 'rgba(29,161,242,.12)', enabled: false },
    { platform: 'Dev.to',    icon: 'article',         handle: '', color: '#3D3D3D', bgColor: 'rgba(61,61,61,.12)',   enabled: false },
    { platform: 'Medium',    icon: 'menu_book',       handle: '', color: '#292929', bgColor: 'rgba(41,41,41,.12)',   enabled: false },
    { platform: 'YouTube',   icon: 'play_circle',     handle: '', color: '#FF0000', bgColor: 'rgba(255,0,0,.1)',     enabled: false },
  ];

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this._seedFromProfile();
  }

  toggle(link: SocialLink): void {
    link.enabled = !link.enabled;
  }

  private _snapshot(): string {
    return JSON.stringify(this.socials.map(s => [s.fieldKey ?? s.platform, s.handle, s.enabled]));
  }

  // ── AdminDirtyComponent ──────────────────────────────────────────
  isDirty(): boolean {
    return !!this._baseline && this._snapshot() !== this._baseline;
  }

  discardChanges(): void {
    this._seedFromProfile();
  }

  saveChanges(): Observable<any> {
    const fd = new FormData();
    for (const link of this.socials) {
      if (link.fieldKey) {
        fd.append(link.fieldKey, link.handle.trim());
      }
    }
    return this.saveWithFeedback(this.appService.updateProfile(fd), 'Social links saved')
      .pipe(tap(() => { this._baseline = this._snapshot(); }));
  }

  onSave(): void {
    if (!this.isDirty() || this.saving()) return;
    this.saving.set(true);
    this.saveChanges().subscribe({
      next:  () => { this.saving.set(false); this.saved.set(true); setTimeout(() => this.saved.set(false), 2000); },
      error: () => this.saving.set(false),
    });
  }

  private _seedFromProfile(): void {
    const p = this.appService.profile();
    if (!p) return;
    this.socials = this.socials.map(s => {
      if (!s.fieldKey) return s;
      const val = (p as any)[s.fieldKey] ?? '';
      return { ...s, handle: val, enabled: !!val || s.enabled };
    });
    this._baseline = this._snapshot();
  }
}
