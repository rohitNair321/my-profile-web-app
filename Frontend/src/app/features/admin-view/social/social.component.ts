import { ChangeDetectionStrategy, Component, computed, Injector, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonApp } from 'src/app/core/services/common';

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
export class AdminSocialComponent extends CommonApp implements OnInit {
  saved = signal(false);
  saving = signal(false);

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

  onSave(): void {
    this.saving.set(true);
    const fd = new FormData();
    // Save the three profile-backed fields
    for (const link of this.socials) {
      if (link.fieldKey && link.handle.trim()) {
        fd.append(link.fieldKey, link.handle.trim());
      }
    }
    this.appService.updateProfile(fd).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2000);
      },
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
  }
}
