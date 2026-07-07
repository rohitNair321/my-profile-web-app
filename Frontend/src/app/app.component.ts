import { CommonModule } from '@angular/common';
import { Component, HostListener, Injector, ChangeDetectionStrategy, signal } from '@angular/core';
import { NavigationEnd, RouterOutlet } from '@angular/router';
import { AlertComponent } from './shared/components/ui/alert-dialog/alert.component';
import { ConfirmDialogComponent } from './shared/components/ui/confirm-dialog/confirm-dialog.component';
import { ErrorBoundaryComponent } from './shared/components/ui/error-boundary/error-boundary.component';
import { SpinnerComponent } from './shared/components/ui/spinner-overlay/spinner.component';
import { AdminLoginModalComponent } from './shared/components/admin-login-modal/admin-login-modal.component';
import { AnalyticsService } from './core/services/analytics.service';
import { filter } from 'rxjs';
import { environment } from 'src/environments/environments';
import { CommonApp } from './core/services/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SpinnerComponent, AlertComponent, ConfirmDialogComponent, ErrorBoundaryComponent, AdminLoginModalComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent extends CommonApp {
  showLoginModal = signal(false);

  constructor(public override injector: Injector, private analytics: AnalyticsService) {
    super(injector);
    if (environment.production) {
      this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event: any) => {
        this.analytics.trackEvent('page_view', {
          page_path: event.urlAfterRedirects
        });
      });
    }
  }

  ngOnInit() {}

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
      // Only open modal if not already logged in as admin
      if (this.authService.role() !== 'ADMIN') {
        e.preventDefault();
        this.showLoginModal.set(true);
      }
    }
  }
}
