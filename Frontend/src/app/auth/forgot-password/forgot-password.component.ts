import { ChangeDetectionStrategy, Component, inject, Injector, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonApp } from 'src/app/core/services/common';

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent extends CommonApp {
  private readonly fb = inject(FormBuilder);

  successMessage = signal<string | null>(null);
  error = signal<string | null>(null);
  sending = signal<boolean>(false);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor(public override injector: Injector) {
    super(injector);
  }

  get email() {
    return this.form.get('email');
  }

  onSubmit(): void {
    if (this.form.invalid || this.sending()) {
      this.form.markAllAsTouched();
      return;
    }

    const { email } = this.form.value;
    this.sending.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.sending.set(false);
        this.successMessage.set(
          'If this email exists in our records, password reset instructions have been sent.'
        );
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(err?.message ?? 'Unable to process request. Please try again.');
      },
    });
  }

  resetSuccess(): void {
    this.successMessage.set(null);
  }
}