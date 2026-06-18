import { ApplicationConfig, ErrorHandler, importProvidersFrom, provideAppInitializer } from '@angular/core';
import { GlobalErrorHandler } from './shared/components/ui/error-boundary/error-boundary.component';

import { provideRouter, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { DialogModule } from '@angular/cdk/dialog';
import { authInterceptor } from './core/interceptors/app.interceptor';
import { provideClientHydration } from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { provideMarkdown } from 'ngx-markdown';
import { AuthService } from './auth/services/auth.service';
import { provideHighcharts } from 'highcharts-angular';


/**
 * Application Initializer
 * This runs BEFORE Angular bootstraps the app
 * Used to restore user session from backend on app startup/refresh
 */
export function initializeApp(authService: AuthService) {
  return (): Promise<void> => {
    return new Promise((resolve) => {
      // Call backend to restore session (admin or guest)
      authService.initiateApp().subscribe({
        next: (_response) => {
          resolve();
        },
        error: (error) => {
          console.warn('⚠️ App initialization failed, continuing as guest', error);
          // Even if init fails, continue loading the app
          resolve();
        }
      });
    });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideMarkdown(),
    provideHighcharts(),
    providePrimeNG({ 
            theme: {
                preset: Aura
            }
        }),
    provideRouter(
      routes, 
      withHashLocation(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
      })
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor]) // <- add if you have one
    ),
    provideAnimations(),
    importProvidersFrom(
      CommonModule,
      ReactiveFormsModule,
      FormsModule,
      CardModule,
      DialogModule
    ),
    // APP_INITIALIZER: Restore user session before app loads
    provideAppInitializer(() => {
        const authService = new AuthService();
        return initializeApp(authService)();
      }), 
    provideClientHydration(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    GlobalErrorHandler,
  ],
};