import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  Injector,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MenuModule } from 'primeng/menu';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CommonApp } from 'src/app/core/services/common';
import { AuthService } from 'src/app/auth/services/auth.service';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-profile-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    RadioButtonModule,
    ButtonModule,
    MenuModule
  ],
  templateUrl: './profile-menu.component.html',
  styleUrls: ['./profile-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileMenuComponent extends CommonApp {

  profileData = computed(() => {
    return (
      this.appService.profile()
    );
  });

  constructor(override injector: Injector) {
    super(injector);
  }

  user = {
    name: 'Rohit Nair',
    email: 'rohit@example.com',
    avatarUrl: '', // fallback to initials if not present
  };

  profileMenuItems: MenuItem[] = [
    {
      label: this.user.name,
      disabled: true,
      styleClass: 'menu-user-header',
    },
    {
      separator: true,
    },
    {
      label: 'Settings',
      icon: 'pi pi-cog',
      command: () => this.navigate('/settings'),
    },
    {
      label: 'Notifications',
      icon: 'pi pi-bell',
      command: () => this.navigate('/notifications'),
    },
    {
      separator: true,
    },
    {
      label: 'Logout',
      icon: 'pi pi-sign-out',
      command: () => this.logout(),
      styleClass: 'menu-logout',
    },
  ];

  navigate(route: string) {
    this.router.navigateByUrl('/admin' + route);
  }

  logout() {
    this.localStorageService.removeItem('auth_token');
    this.authService.logout();
  }

}
