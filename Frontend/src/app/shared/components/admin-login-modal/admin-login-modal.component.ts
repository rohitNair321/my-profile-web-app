import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';
import { AuthService } from 'src/app/auth/services/auth.service';

@Component({
  selector: 'app-admin-login-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-login-modal.component.html',
  styleUrls: ['./admin-login-modal.component.scss'],
})
export class AdminLoginModalComponent {
  @Output() close = new EventEmitter<void>();

  email = '';
  password = '';
  error = '';
  loading = false;
  showPassword = false;

  constructor(private authService: AuthService, private router: Router) {}

  submit(): void {
    if (!this.email || !this.password) {
      this.error = 'Please enter email and password.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.authService.login({ email: this.email, password: this.password })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.router.navigate(['/admin/overview']);
          this.close.emit();
        },
        error: () => {
          this.error = 'Invalid credentials. Try admin@demo.com / admin123';
          this.loading = false;
        },
      });
  }

  onBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('alm-backdrop')) {
      this.close.emit();
    }
  }
}
