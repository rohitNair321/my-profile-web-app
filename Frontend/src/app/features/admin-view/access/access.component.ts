import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccessApiService, GrantablePage, ManagedUser } from 'src/app/core/services/access-api.service';
import { AlertService } from 'src/app/core/services/alert.service';

/**
 * Access console (super admin) — provision users by email and grant them a
 * subset of admin pages. The generated temp password is revealed ONCE.
 */
@Component({
  selector: 'app-access',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './access.component.html',
  styleUrls: ['./access.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessComponent implements OnInit {
  private api = inject(AccessApiService);
  private alert = inject(AlertService);

  pages = signal<GrantablePage[]>([]);
  users = signal<ManagedUser[]>([]);
  loading = signal(false);
  saving = signal(false);

  // New-user form
  newEmail = '';
  newRole: 'admin' | 'user' = 'user';
  newPages = signal<Set<string>>(new Set());

  // One-time credential reveal after provisioning
  revealed = signal<{ email: string; tempPassword: string } | null>(null);

  // Inline per-user access editing
  editingId = signal<string | null>(null);
  editPages = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getPages().subscribe({ next: p => this.pages.set(p), error: () => {} });
    this.api.listUsers().subscribe({
      next: u => { this.users.set(u); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  // ── New user ───────────────────────────────────────────────────
  toggleNewPage(key: string): void {
    const s = new Set(this.newPages());
    s.has(key) ? s.delete(key) : s.add(key);
    this.newPages.set(s);
  }

  createUser(): void {
    const email = this.newEmail.trim();
    if (!email) { this.alert.error('Email is required'); return; }
    this.saving.set(true);
    this.api.createUser({ email, role: this.newRole, pages: [...this.newPages()] }).subscribe({
      next: res => {
        this.saving.set(false);
        this.revealed.set({ email: res.user.email, tempPassword: res.tempPassword });
        this.users.update(list => [...list, res.user]);
        this.newEmail = '';
        this.newRole = 'user';
        this.newPages.set(new Set());
      },
      error: err => {
        this.saving.set(false);
        this.alert.error(err?.error?.message ?? 'Failed to create user');
      },
    });
  }

  dismissReveal(): void { this.revealed.set(null); }

  copyPassword(): void {
    const pw = this.revealed()?.tempPassword;
    if (pw && navigator?.clipboard) navigator.clipboard.writeText(pw).catch(() => {});
  }

  // ── Edit grants ────────────────────────────────────────────────
  startEdit(u: ManagedUser): void {
    this.editingId.set(u.id);
    this.editPages.set(new Set(u.pages));
  }

  toggleEditPage(key: string): void {
    const s = new Set(this.editPages());
    s.has(key) ? s.delete(key) : s.add(key);
    this.editPages.set(s);
  }

  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(u: ManagedUser): void {
    const pages = [...this.editPages()];
    this.api.updateAccess(u.id, pages).subscribe({
      next: () => {
        this.users.update(list => list.map(x => x.id === u.id ? { ...x, pages } : x));
        this.editingId.set(null);
        this.alert.success('Access updated');
      },
      error: err => this.alert.error(err?.error?.message ?? 'Failed to update access'),
    });
  }

  toggleActive(u: ManagedUser): void {
    this.api.setStatus(u.id, !u.is_active).subscribe({
      next: updated => this.users.update(list => list.map(x => x.id === u.id ? { ...x, is_active: updated.is_active } : x)),
      error: err => this.alert.error(err?.error?.message ?? 'Failed to update status'),
    });
  }

  isEditPageOn(key: string): boolean { return this.editPages().has(key); }
  isNewPageOn(key: string): boolean { return this.newPages().has(key); }
}
