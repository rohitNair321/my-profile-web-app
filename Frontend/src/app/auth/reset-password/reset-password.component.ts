import { ChangeDetectionStrategy, Component, inject, Injector, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonApp } from 'src/app/core/services/common';

@Component({
  standalone: true,
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'], // Changed .css to .scss for consistency
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent extends CommonApp implements OnInit {
  private readonly fb = inject(FormBuilder);
  // private readonly route = inject(ActivatedRoute);

  // v18 Signals
  successMessage = signal<string | null>(null);
  error = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  token: string | null = null;

  form: FormGroup = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: this.passwordsMatchValidator });

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
  }

  get password() { return this.form.get('password'); }
  get confirmPassword() { return this.form.get('confirmPassword'); }

  passwordsMatchValidator(group: AbstractControl) {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { mismatch: true };
  }

  onSubmit(): void {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.token) {
      this.error.set('Invalid or missing reset token.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.successMessage.set(null);

    this.authService.resetPassword(this.token, this.password?.value).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set('Your password has been successfully updated.');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.message ?? 'Reset failed. The link may have expired.');
      }
    });
  }
}