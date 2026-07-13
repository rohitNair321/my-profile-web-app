import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AppService, mapBackendRole } from "../services/app.service";
import { AuthService } from "src/app/auth/services/auth.service";
import { map, catchError, of } from "rxjs";
import { CommonApp } from "../services/common";

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

      // Does this role satisfy ANY of the route's required roles?
      //  - SUPERADMIN → god mode, always allowed.
      //  - ADMIN → satisfies routes that list 'ADMIN'.
      //  - USER → satisfies routes that list 'USER', or an 'ADMIN' route whose
      //           pageKey has been granted to them.
      const allowed =
        role === 'SUPERADMIN' ||
        (role === 'ADMIN' && requiredRoles.includes('ADMIN')) ||
        (role === 'USER' && requiredRoles.includes('USER')) ||
        (role === 'USER' && requiredRoles.includes('ADMIN') &&
          !!route.data?.['pageKey'] &&
          appService.accessiblePages().includes(route.data['pageKey']));

      if (!allowed) {
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