import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AppService, mapBackendRole, UserRole } from "../services/app.service";
import { AuthService } from "src/app/auth/services/auth.service";
import { map, catchError, of } from "rxjs";
import { CommonApp } from "../services/common";

const ADMIN_TIER: UserRole[] = ['ADMIN', 'SUPERADMIN'];

export const tokenGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const appService = inject(AppService);
  const themeService = inject(CommonApp);

  return authService.initiateApp().pipe(
    map((res: any) => {
      const role = mapBackendRole(res?.data?.role);
      appService.setRole(role);
      themeService.applyThemeFromProfile(res.data.appData);

      const requiredRoles: string[] = route.data?.['roles'] ?? [];
      if (requiredRoles.length === 0) return true; // public route

      // SUPERADMIN-only routes (e.g. the Access console).
      if (requiredRoles.includes('SUPERADMIN') && role !== 'SUPERADMIN') {
        router.navigate(['/login']);
        return false;
      }

      // ADMIN-tier routes — admin and super admin both pass.
      if (requiredRoles.includes('ADMIN') && !ADMIN_TIER.includes(role)) {
        // A USER may still reach a granted admin page (page-key check).
        const pageKey = route.data?.['pageKey'];
        if (role === 'USER' && pageKey && appService.accessiblePages().includes(pageKey)) {
          return true;
        }
        router.navigate(['/login']);
        return false;
      }
      return true;
    }),
    catchError(() => {
      // Don't enforce login loop for public guests!
      const isAdminRoute = route.data?.['roles']?.includes('ADMIN');
      appService.setRole('GUEST');
      
      if (isAdminRoute) {
        router.navigate(['/login']);
        return of(false);
      }
      return of(true); 
    })
  );
};