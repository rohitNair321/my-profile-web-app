import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { authInterceptor } from './app.interceptor';
import { AuthService } from 'src/app/auth/services/auth.service';
import { AlertService } from '../services/alert.service';
import { LoadingService } from '../services/loading.service';
import { LocalStorageService } from 'src/app/shared/services/local-storage.service';
import { AppService } from '../services/app.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  const tokenSignal = signal<string | null>(null);
  const mockAuthService = {
    token:       tokenSignal,
    role:        signal<string | null>(null),
    logoutState: jasmine.createSpy('logoutState'),
  };

  const mockAlertService  = { showAlert: jasmine.createSpy('showAlert') };
  const mockLoadingService = { show: jasmine.createSpy('show'), hide: jasmine.createSpy('hide') };
  const mockLocalStorage   = { getItem: jasmine.createSpy().and.returnValue(null), setItem: jasmine.createSpy(), clear: jasmine.createSpy() };
  const mockAppService     = { setRole: jasmine.createSpy(), _profile: { set: jasmine.createSpy() } };

  beforeEach(() => {
    tokenSignal.set(null);
    mockAuthService.logoutState.calls.reset();
    mockAlertService.showAlert.calls.reset();
    mockLoadingService.hide.calls.reset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'auth/login', redirectTo: '' }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService,        useValue: mockAuthService },
        { provide: AlertService,       useValue: mockAlertService },
        { provide: LoadingService,     useValue: mockLoadingService },
        { provide: LocalStorageService, useValue: mockLocalStorage },
        { provide: AppService,         useValue: mockAppService },
      ],
    });

    http     = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('adds Authorization header when token is present', fakeAsync(() => {
    tokenSignal.set('my-jwt-token');

    http.get('/api/test').subscribe();
    tick();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-jwt-token');
    req.flush({});
  }));

  it('does NOT add Authorization header when token is absent', fakeAsync(() => {
    tokenSignal.set(null);

    http.get('/api/test').subscribe();
    tick();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  }));

  it('sets withCredentials: true on every request', fakeAsync(() => {
    http.get('/api/test').subscribe();
    tick();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  }));

  it('calls loading.hide() in finalize on success', fakeAsync(() => {
    http.get('/api/test').subscribe();
    tick();

    const req = httpMock.expectOne('/api/test');
    req.flush({});
    tick();

    expect(mockLoadingService.hide).toHaveBeenCalled();
  }));

  it('calls loading.hide() in finalize on error', fakeAsync(() => {
    http.get('/api/test').subscribe({ error: () => {} });
    tick();

    const req = httpMock.expectOne('/api/test');
    req.flush('error', { status: 500, statusText: 'Server Error' });
    tick();

    expect(mockLoadingService.hide).toHaveBeenCalled();
  }));

  it('shows alert and calls logoutState on 401', fakeAsync(() => {
    http.get('/api/protected').subscribe({ error: () => {} });
    tick();

    const req = httpMock.expectOne('/api/protected');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    tick();

    expect(mockAlertService.showAlert).toHaveBeenCalledWith(
      jasmine.any(String), 'warning'
    );
    expect(mockAuthService.logoutState).toHaveBeenCalled();
  }));

  it('shows warning alert on 403', fakeAsync(() => {
    http.get('/api/admin').subscribe({ error: () => {} });
    tick();

    const req = httpMock.expectOne('/api/admin');
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
    tick();

    expect(mockAlertService.showAlert).toHaveBeenCalledWith(
      jasmine.any(String), 'warning'
    );
  }));

  it('shows error alert on 500', fakeAsync(() => {
    http.get('/api/crash').subscribe({ error: () => {} });
    tick();

    const req = httpMock.expectOne('/api/crash');
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    tick();

    expect(mockAlertService.showAlert).toHaveBeenCalledWith(
      jasmine.any(String), 'error'
    );
  }));
});
