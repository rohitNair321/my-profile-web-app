import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AppService } from "../services/app.service";
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
      const role = res?.data.role === 'admin' ? 'ADMIN' : "GUEST";
      appService.setRole(role);
      themeService.applyThemeFromProfile(res.data.appData);

      const isAdminRoute = route.data?.['roles']?.includes('ADMIN');

      if (isAdminRoute && role !== 'ADMIN') {
        router.navigate(['/login']);
        return false;
      }
      return true; // Let guests view public pages
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