import { ChangeDetectionStrategy, Component, computed, Injector, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonApp } from 'src/app/core/services/common';

interface LogEntry { icon: string; ok: boolean; label: string; detail: string; time: string; }

@Component({
  selector: 'app-admin-security',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './security.component.html',
  styleUrls: ['./security.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSecurityComponent extends CommonApp {
  // Pull admin email from profile signal
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

  readonly strengthColors = ['', '#EF4444', '#F59E0B', '#F59E0B', '#10B981'];
  readonly strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  get strength(): number {
    let s = 0;
    if (this.newPwd.length >= 8)           s++;
    if (/[A-Z]/.test(this.newPwd))         s++;
    if (/[0-9]/.test(this.newPwd))         s++;
    if (/[^A-Za-z0-9]/.test(this.newPwd)) s++;
    return s;
  }

  // Static activity log — no API backing yet; kept for UI completeness
  readonly log: LogEntry[] = [
    { icon: 'login',         ok: true,  label: 'Admin login',          detail: 'Chrome · Pune, India',  time: 'Today 02:14 PM' },
    { icon: 'login',         ok: true,  label: 'Admin login',          detail: 'Chrome · Pune, India',  time: 'Yesterday 10:31 AM' },
    { icon: 'no_encryption', ok: false, label: 'Failed login attempt', detail: 'Unknown browser · US',  time: '2 days ago 07:52 PM' },
    { icon: 'password',      ok: true,  label: 'Password changed',     detail: 'Chrome · Pune, India',  time: '7 days ago 11:00 AM' },
    { icon: 'login',         ok: true,  label: 'Admin login',          detail: 'Safari · India',        time: '9 days ago 09:15 AM' },
  ];

  constructor(public override injector: Injector) {
    super(injector);
  }

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
