import { CommonModule } from '@angular/common';
import { Component, Injector , ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { defaultConfig, LayoutConfig } from 'src/app/core/config/layout.config';
import { CommonApp } from 'src/app/core/services/common';
import { AlertComponent } from 'src/app/shared/components/ui/alert-dialog/alert.component';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './auth-layout.component.html',
  styleUrls: ['./auth-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent extends CommonApp {

  config: LayoutConfig = defaultConfig;

  constructor(public override injector: Injector,) {
    super(injector);
    this.config.theme.name = 'theme-2';
    this.config.appConfiguration.theme = 'light';
  }
}
