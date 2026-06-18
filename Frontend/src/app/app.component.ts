import { CommonModule } from '@angular/common';
import { Component, Injector , ChangeDetectionStrategy } from '@angular/core';
import { NavigationEnd, RouterOutlet } from '@angular/router';
import { AlertComponent } from './shared/components/ui/alert-dialog/alert.component';
import { ErrorBoundaryComponent } from './shared/components/ui/error-boundary/error-boundary.component';
import { SpinnerComponent } from './shared/components/ui/spinner-overlay/spinner.component';
import { AnalyticsService } from './core/services/analytics.service';
import { filter } from 'rxjs';
import { environment } from 'src/environments/environments';
import { CommonApp } from './core/services/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SpinnerComponent, AlertComponent, ErrorBoundaryComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent extends CommonApp {

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

  ngOnInit() {
    
  }



}
