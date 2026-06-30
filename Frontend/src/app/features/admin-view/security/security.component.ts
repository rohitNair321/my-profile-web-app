import { ChangeDetectionStrategy, Component, computed, Injector, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonApp } from 'src/app/core/services/common';
import { ActivityApiService, FieldChange, LoginEntry } from 'src/app/core/services/activity-api.service';

type ActivityTab = 'logins' | 'changes';

const FIELD_LABELS: Record<string, string> = {
  full_name:       'Full Name',
  description:     'Professional Bio',
  short_bio:       'Short Bio',
  email:           'Email',
  primary_phone:   'Primary Phone',
  secondary_phone: 'Secondary Phone',
  location:        'Location',
  website:         'Website',
  linkedin:        'LinkedIn',
  github:          'GitHub',
  logo_initials:   'Logo Initials',
  currenttheme:    'Active Theme',
  about_heading:   'About Heading',
  about_role:      'Job Title',
  open_to_work:    'Open to Work',
  skills:          'Skills',
  experiences:     'Experience',
  themes:          'Themes',
  avatar:          'Profile Photo',
  resume:          'Resume',
};

@Component({
  selector: 'app-admin-security',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './security.component.html',
  styleUrls: ['./security.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSecurityComponent extends CommonApp implements OnInit {
  adminEmail = computed(() => this.appService.profile()?.email ?? '');

  currentPwd  = '';
  newPwd      = '';
  confirmPwd  = '';
  showCurrent = signal(false);
  showNew     = signal(false);
  showConfirm = signal(false);
  saving      = signal(false);
  saveError   = signal('');
  saveOk      = signal(false);

  // Activity log state
  activityTab    = signal<ActivityTab>('logins');
  logins         = signal<LoginEntry[]>([]);
  changes        = signal<FieldChange[]>([]);
  logLoading     = signal(true);
  logError       = signal(false);

  private activityApi: ActivityApiService;

  readonly strengthColors = ['', '#EF4444', '#F59E0B', '#F59E0B', '#10B981'];
  readonly strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  readonly fieldLabels    = FIELD_LABELS;

  get strength(): number {
    let s = 0;
    if (this.newPwd.length >= 8)           s++;
    if (/[A-Z]/.test(this.newPwd))         s++;
    if (/[0-9]/.test(this.newPwd))         s++;
    if (/[^A-Za-z0-9]/.test(this.newPwd)) s++;
    return s;
  }

  constructor(public override injector: Injector) {
    super(injector);
    this.activityApi = injector.get(ActivityApiService);
  }

  ngOnInit(): void {
    this.loadActivity();
  }

  switchActivityTab(tab: ActivityTab): void {
    this.activityTab.set(tab);
  }

  loadActivity(): void {
    this.logLoading.set(true);
    this.logError.set(false);

    // Load logins and field changes in parallel
    let loginsDone  = false;
    let changesDone = false;
    const check = () => { if (loginsDone && changesDone) this.logLoading.set(false); };

    this.activityApi.getLogins(30).subscribe({
      next: res => { this.logins.set(res.logins ?? []); loginsDone = true; check(); },
      error: ()  => { loginsDone = true; this.logError.set(true); check(); },
    });

    this.activityApi.getFieldChanges({ entity: 'profile', limit: 50 }).subscribe({
      next: res => { this.changes.set(res.changes ?? []); changesDone = true; check(); },
      error: ()  => { changesDone = true; this.logError.set(true); check(); },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────

  parseBrowser(ua: string | null): string {
    if (!ua) return 'Unknown browser';
    if (/Edg\//.test(ua))                              return 'Edge';
    if (/OPR\//.test(ua) || /Opera/.test(ua))          return 'Opera';
    if (/Chrome\//.test(ua) && !/Chromium/.test(ua))   return 'Chrome';
    if (/Firefox\//.test(ua))                          return 'Firefox';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua))   return 'Safari';
    return 'Browser';
  }

  relativeTime(iso: string): string {
    const diff  = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7)   return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  fieldLabel(name: string): string {
    return FIELD_LABELS[name] ?? name.replace(/_/g, ' ');
  }

  truncate(value: string | null, max = 38): string {
    if (!value) return '—';
    // For JSON arrays/objects, show a friendlier summary
    if (value.startsWith('[')) {
      try { const arr = JSON.parse(value); return `${arr.length} item${arr.length !== 1 ? 's' : ''}`; }
      catch { /* fall through */ }
    }
    return value.length > max ? value.slice(0, max) + '…' : value;
  }

  // ── Password ───────────────────────────────────────────────────

  onSavePassword(): void {
    this.saveError.set('');
    if (!this.currentPwd || !this.newPwd || !this.confirmPwd) {
      this.saveError.set('All fields are required.');
      return;
    }
    if (this.newPwd !== this.confirmPwd) {
      this.saveError.set('New passwords do not match.');
      return;
    }
    if (this.strength < 2) {
      this.saveError.set('Password is too weak.');
      return;
    }

    this.saving.set(true);
    this.authService.updatePassword({
      email:           this.adminEmail(),
      currentPassword: this.currentPwd,
      newPassword:     this.newPwd,
    } as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveOk.set(true);
        this.currentPwd = this.newPwd = this.confirmPwd = '';
        setTimeout(() => this.saveOk.set(false), 3000);
      },
      error: (err: any) => {
        this.saving.set(false);
        this.saveError.set(err?.error?.message ?? 'Failed to update password.');
      },
    });
  }
}
