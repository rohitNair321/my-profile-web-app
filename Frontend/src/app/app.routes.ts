import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { tokenGuard } from './core/app-gards/token.guard';
import { PageNotFoundComponent } from './layouts/page-not-found/page-not-found.component';
import { canDeactivateGuard } from './core/app-gards/can-deactivate.guard';
import { unsavedChangesGuard } from './core/app-gards/unsaved-changes.guard';

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
          import('./features/user-view/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'home',
        loadComponent: () =>
          import('./features/user-view/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./features/user-view/about-me/about-me.component').then(m => m.AboutMeComponent),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/user-view/projects-page/projects-page.component')
            .then(m => m.ProjectsPageComponent),
      },
      // ── Public Posts ──────────────────────────────────
      {
        path: 'posts',
        loadComponent: () =>
          import('./features/user-view/posts/posts-list/posts-list.component')
            .then(m => m.PostsListComponent),
        title: 'Posts — Rohit Nair',
      },
      {
        path: 'posts/:slug',
        loadComponent: () =>
          import('./features/user-view/posts/post-detail/post-detail.component')
            .then(m => m.PostDetailComponent),
      },
      // ── Public portfolio for a specific owner (multi-tenant) ──
      {
        path: 'u/:id',
        loadComponent: () =>
          import('./features/user-view/public-portfolio/public-portfolio.component')
            .then(m => m.PublicPortfolioComponent),
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
  
  // Admin-only routes — independent AdminLayout (separate from public MainLayout)
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [tokenGuard],
    children: [
      // Default redirect
      { path: '', redirectTo: 'overview', pathMatch: 'full' },

      // ── Overview dashboard ────────────────────────────
      {
        path: 'overview',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/overview/overview.component').then(m => m.OverviewComponent),
        data: { roles: ['ADMIN'] },
      },

      // ── Planner (Kanban tasks + timer) ────────────────
      {
        path: 'planner',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/planner/planner.component').then(m => m.PlannerComponent),
        data: { roles: ['ADMIN'] },
      },

      // ── Access console (super admin only) ─────────────
      {
        path: 'access',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/access/access.component').then(m => m.AccessComponent),
        data: { roles: ['SUPERADMIN'], pageKey: 'access' },
      },

      // ── Settings (moved to admin-view) ───────────────
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/admin-view/settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [tokenGuard],
        canDeactivate: [canDeactivateGuard],
        data: { roles: ['ADMIN'] }
      },

      // ── Notifications (moved to admin-view) ───────────
      {
        path: 'notification',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/notification/notification.component').then(m => m.NotificationComponent),
        data: { roles: ['ADMIN'] }
      },

      // ── Help ──────────────────────────────────────────
      {
        path: 'help',
        loadComponent: () =>
          import('./features/user-view/help/help.component').then(m => m.HelpComponent),
      },

      // ── Admin Posts ───────────────────────────────────
      {
        path: 'posts',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/posts/admin-posts/admin-posts.component')
            .then(m => m.AdminPostsComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'posts/new',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/posts/post-editor/post-editor.component')
            .then(m => m.PostEditorComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'posts/:id/edit',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/posts/post-editor/post-editor.component')
            .then(m => m.PostEditorComponent),
        data: { roles: ['ADMIN'] },
      },

      // ── Profile (new admin-view page) ─────────────────
      {
        path: 'profile',
        canActivate: [tokenGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/admin-view/profile/profile.component').then(m => m.AdminProfileComponent),
        data: { roles: ['ADMIN'] },
      },

      // ── Real admin pages ───────────────────────────────
      {
        path: 'experience',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/experience/experience.component').then(m => m.AdminExperienceComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'projects',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/projects/projects.component').then(m => m.AdminProjectsComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'skills',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/skills/skills.component').then(m => m.AdminSkillsComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'themes',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/themes/themes.component').then(m => m.AdminThemesComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'blog',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/blog/blog.component').then(m => m.AdminBlogComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'about',
        canActivate: [tokenGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/admin-view/about/about.component').then(m => m.AdminAboutComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'ai',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/ai-usage/ai-usage.component').then(m => m.AdminAiUsageComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'analytics',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/analytics/analytics.component').then(m => m.AdminAnalyticsComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'security',
        canActivate: [tokenGuard],
        loadComponent: () =>
          import('./features/admin-view/security/security.component').then(m => m.AdminSecurityComponent),
        data: { roles: ['ADMIN'] },
      },
      {
        path: 'social',
        canActivate: [tokenGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/admin-view/social/social.component').then(m => m.AdminSocialComponent),
        data: { roles: ['ADMIN'] },
      },
    ],
  },
  { path: '**', component: PageNotFoundComponent },
];