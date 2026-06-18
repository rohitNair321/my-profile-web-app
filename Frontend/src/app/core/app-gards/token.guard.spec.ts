import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { tokenGuard } from './token.guard';
import { AuthService } from 'src/app/auth/services/auth.service';
import { AppService } from '../services/app.service';
import { CommonApp } from '../services/common';
import { LocalStorageService } from 'src/app/shared/services/local-storage.service';

describe('tokenGuard', () => {
  let router: Router;

  const mockAuthService = {
    initiateApp: jasmine.createSpy('initiateApp'),
    role: jasmine.createSpy('role').and.returnValue(null),
  };

  const mockAppService = {
    setRole: jasmine.createSpy('setRole'),
    role: jasmine.createSpy('role').and.returnValue(null),
    _profile: { set: jasmine.createSpy('set') },
  };

  const mockThemeService = {
    applyThemeFromProfile: jasmine.createSpy('applyThemeFromProfile'),
  };

  const mockLocalStorage = {
    getItem: jasmine.createSpy('getItem').and.returnValue(null),
    setItem: jasmine.createSpy('setItem'),
    clear: jasmine.createSpy('clear'),
  };

  function makeRoute(roles: string[] = ['ADMIN']): ActivatedRouteSnapshot {
    const snap = new ActivatedRouteSnapshot();
    (snap as any).data = { roles };
    return snap;
  }

  beforeEach(() => {
    mockAuthService.initiateApp.calls.reset();
    mockAppService.setRole.calls.reset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', redirectTo: '' }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService,       useValue: mockAuthService },
        { provide: AppService,        useValue: mockAppService },
        { provide: CommonApp,         useValue: mockThemeService },
        { provide: LocalStorageService, useValue: mockLocalStorage },
      ],
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  function runGuard(roles: string[] = ['ADMIN']) {
    return TestBed.runInInjectionContext(() =>
      tokenGuard(makeRoute(roles), {} as RouterStateSnapshot)
    );
  }

  it('allows navigation when backend returns admin role', fakeAsync(() => {
    mockAuthService.initiateApp.and.returnValue(
      of({ data: { role: 'admin', appData: null } })
    );

    let result: boolean | undefined;
    (runGuard() as any).subscribe((v: boolean) => (result = v));
    tick();

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('redirects to /login when backend returns guest on admin route', fakeAsync(() => {
    mockAuthService.initiateApp.and.returnValue(
      of({ data: { role: 'guest', appData: null } })
    );

    let result: boolean | undefined;
    (runGuard() as any).subscribe((v: boolean) => (result = v));
    tick();

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  }));

  it('redirects to /login on auth error for admin route', fakeAsync(() => {
    mockAuthService.initiateApp.and.returnValue(throwError(() => new Error('network')));

    let result: boolean | undefined;
    (runGuard() as any).subscribe((v: boolean) => (result = v));
    tick();

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  }));

  it('allows navigation on error for public route (no roles required)', fakeAsync(() => {
    mockAuthService.initiateApp.and.returnValue(throwError(() => new Error('network')));

    let result: boolean | undefined;
    (runGuard([]) as any).subscribe((v: boolean) => (result = v));
    tick();

    expect(result).toBe(true);
  }));
});
