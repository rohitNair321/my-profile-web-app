import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/services/auth.service';
import { AlertService } from '../services/alert.service';
import { LoadingService } from '../services/loading.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const alert = inject(AlertService);
  const loading = inject(LoadingService);

  const token = auth.token();
  const setHeaders: Record<string, string> = {};

  if (token) {
    setHeaders['Authorization'] = `Bearer ${token}`;
  }

  const cloned = req.clone({ setHeaders, withCredentials: true });

  return next(cloned).pipe(
    catchError((err: HttpErrorResponse) => {
      switch (err.status) {
        case 400: {
          const msg = (err.error as { message?: string })?.message ?? 'Invalid request.';
          alert.showAlert(msg, 'error');
          break;
        }
        case 401:
          if (!router.url.includes('/login') && !router.url.includes('/home')) {
            alert.showAlert('Session expired. Please log in.', 'warning');
            auth.logoutState();
            router.navigate(['/login']);
          }
          break;
        case 403:
          alert.showAlert('Unauthorized access denied.', 'warning');
          break;
        case 500:
          alert.showAlert('Server error! Please try again later.', 'error');
          break;
      }
      return throwError(() => err);
    }),
    finalize(() => loading.hide())
  );
};
