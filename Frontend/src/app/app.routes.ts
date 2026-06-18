import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { tokenGuard } from './core/app-gards/token.guard';
import { PageNotFoundComponent } from './layouts/page-not-found/page-not-found.component';
import { canDeactivateGuard } from './core/app-gards/can-deactivate.guard';

export const routes: Routes = [
  // Main application routes - accessible to everyone (guest + admin)
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/about-me/about-me.component').then(m => m.AboutMeComponent),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects-page/projects-page.component')
            .then(m => m.ProjectsPageComponent),
      },
      // ── Public Posts ──────────────────────────────────
      {
        path: 'posts',
        loadComponent: () =>
          import('./features/posts/posts-list/posts-list.component')
            .then(m => m.PostsListComponent),
        title: 'Posts — Rohit Nair',
      },
      {
        path: 'posts/:slug',
        loadComponent: () =>
          import('./features/posts/post-detail/post-detail.component')
            .then(m => m.PostDetailComponent),
      },
    ],
  },

  // Auth routes - for login/register (separate layout)
  {
    path: 'auth',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./auth/login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./auth/register/register.component').then(m => m.RegisterComponent),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./auth/forgot-password/forgot-password.component')
            .then(m => m.ForgotPasswordComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./auth/reset-password/reset-password.component')
            .then(m => m.ResetPasswordComponent),
      },
    ],
  },
  
  // Admin-only routes - require authentication
  {
    path: 'admin',
    component: MainLayoutComponent,
    canActivate: [tokenGuard],
    children: [
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [tokenGuard],
        canDeactivate: [canDeactivateGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notification/notification.component').then(m => m.NotificationComponent),
        canActivate: [tokenGuard],
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'help',
        loadComponent: () =>
          import('./features/help/help.component').then(m => m.HelpComponent),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects-page/projects-page.component')
            .then(m => m.ProjectsPageComponent),
      },
      // ── Admin Posts ───────────────────────────────────
      {
        path: 'posts',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/posts/admin-posts/admin-posts.component')
            .then(m => m.AdminPostsComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'posts/new',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/posts/post-editor/post-editor.component')
            .then(m => m.PostEditorComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'posts/:id/edit',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/posts/post-editor/post-editor.component')
            .then(m => m.PostEditorComponent),
        data: { roles: ['ADMIN'] },
      },
    ],
  },
  { path: '**', component: PageNotFoundComponent },
];