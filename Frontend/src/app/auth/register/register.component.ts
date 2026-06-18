import { ChangeDetectionStrategy, Component, inject, Injector, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonApp } from 'src/app/core/services/common';

@Component({
  standalone: true,
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent extends CommonApp {
  private readonly fb = inject(FormBuilder);

  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  form: FormGroup = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]],
    },
    { validators: [RegisterComponent.passwordsMatchValidator] }
  );

  constructor(public override injector: Injector) {
    super(injector);
  }

  static passwordsMatchValidator(group: AbstractControl) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  // Getters for cleaner template access
  get name() { return this.form.get('name'); }
  get email() { return this.form.get('email'); }
  get password() { return this.form.get('password'); }
  get confirmPassword() { return this.form.get('confirmPassword'); }
  get acceptTerms() { return this.form.get('acceptTerms'); }

  onSubmit(): void {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }
    
    const { name, email, password } = this.form.value;
    this.isLoading.set(true);
    this.error.set(null);

    this.authService.register({ name, email, password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/login'], { queryParams: { registered: true } });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.message ?? 'Unable to register. Please try again.');
      },
    });
  }

  onLoginWithGoogle(): void {
    if (this.isLoading()) return;
    // Implementation logic here
  }

  onLoginWithFacebook(): void {
    if (this.isLoading()) return;
    // Implementation logic here
  }
}