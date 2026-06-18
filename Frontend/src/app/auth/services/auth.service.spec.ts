import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { AppService } from 'src/app/core/services/app.service';
import { LocalStorageService } from 'src/app/shared/services/local-storage.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const mockAppService = {
    setRole: jasmine.createSpy('setRole'),
    _profile: { set: jasmine.createSpy('set') },
    role: jasmine.createSpy('role').and.returnValue(null),
  };

  const mockLocalStorage = {
    getItem: jasmine.createSpy('getItem').and.returnValue(null),
    setItem: jasmine.createSpy('setItem'),
    removeItem: jasmine.createSpy('removeItem'),
    clear: jasmine.createSpy('clear'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AppService, useValue: mockAppService },
        { provide: LocalStorageService, useValue: mockLocalStorage },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    jasmine.getDefaultReporter().showColors = false;
  });

  // ── initiateApp ────────────────────────────────────────────────

  describe('initiateApp()', () => {
    it('sets role to ADMIN when backend returns admin', fakeAsync(() => {
      service.initiateApp().subscribe();

      const req = httpMock.expectOne(r => r.url.includes('/init'));
      req.flush({ data: { role: 'admin', id: 'u1', email: 'a@b.com' } });
      tick();

      expect(mockAppService.setRole).toHaveBeenCalledWith('ADMIN');
    }));

    it('sets role to GUEST when backend returns guest', fakeAsync(() => {
      service.initiateApp().subscribe();

      const req = httpMock.expectOne(r => r.url.includes('/init'));
      req.flush({ data: { role: 'guest', id: null, email: null } });
      tick();

      expect(mockAppService.setRole).toHaveBeenCalledWith('GUEST');
    }));

    it('defaults to GUEST on network error', fakeAsync(() => {
      service.initiateApp().subscribe();

      const req = httpMock.expectOne(r => r.url.includes('/init'));
      req.error(new ProgressEvent('network error'));
      tick();

      expect(mockAppService.setRole).toHaveBeenCalledWith('GUEST');
    }));
  });

  // ── login ──────────────────────────────────────────────────────

  describe('login()', () => {
    it('stores token and sets ADMIN role on success', fakeAsync(() => {
      service.login({ email: 'a@b.com', password: 'pass' }).subscribe();

      const req = httpMock.expectOne(r => r.url.includes('/login'));
      req.flush({ data: { token: 'jwt-token', user: { role: 'admin', id: 'u1' } } });
      tick();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('auth_token', 'jwt-token');
      expect(service.role()).toBe('ADMIN');
    }));
  });

  // ── logoutState ────────────────────────────────────────────────

  describe('logoutState()', () => {
    it('clears user, role, and token signals', () => {
      service.logoutState();

      expect(service.user()).toBeNull();
      expect(service.token()).toBeNull();
      expect(service.role()).toBeNull();
      expect(mockLocalStorage.clear).toHaveBeenCalled();
    });
  });

  // ── forgotPassword ─────────────────────────────────────────────

  describe('forgotPassword()', () => {
    it('sends POST to forgot-password endpoint', fakeAsync(() => {
      service.forgotPassword('test@test.com').subscribe();
      const req = httpMock.expectOne(r => r.url.includes('forgot-password'));
      expect(req.request.method).toBe('POST');
      req.flush({ message: 'If this email exists...' });
      tick();
    }));
  });
});
