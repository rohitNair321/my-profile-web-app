import { ChangeDetectionStrategy, Component, inject, Injector, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonApp } from 'src/app/core/services/common';
import { SeoService } from 'src/app/core/services/seo.service';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent extends CommonApp implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly seo = inject(SeoService);

  isloading = signal<boolean>(false);
  error = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [true],
  });

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.seo.set({
      title: 'Admin Login',
      description: 'Portfolio admin panel — Rohit Nair.',
    });
  }

  get email() {
    return this.form.get('email');
  }

  get password() {
    return this.form.get('password');
  }

  onSubmit(): void {
    if (this.form.invalid || this.isloading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.show('Authenticating...');
    this.error.set(null);

    this.authService.login(this.form.value).subscribe({
      next: () => {
        this.loading.hide();
        this.appService.setRole('ADMIN');
        this.router.navigate(['/']);
      },
      error: () => {
        this.loading.hide();
        this.error.set('Invalid Admin Credentials');
      },
    });
  }

  onLoginWithGoogle(): void {
    this.isloading.set(true);
    this.authService.loginWithGoogle().subscribe({
      next: () => {
        this.isloading.set(false);
        this.router.navigateByUrl('/');
      },
      error: (err) => {
        this.isloading.set(false);
        this.error.set(err?.message ?? 'Google login failed.');
      },
    });
  }

  onLoginWithFacebook(): void {
    this.isloading.set(true);
    this.authService.loginWithFacebook().subscribe({
      next: () => {
        this.isloading.set(false);
        this.router.navigateByUrl('/');
      },
      error: (err) => {
        this.isloading.set(false);
        this.error.set(err?.message ?? 'Facebook login failed.');
      },
    });
  }

  cancelLogin(): void {
    this.router.navigate(['/']);
  }
}