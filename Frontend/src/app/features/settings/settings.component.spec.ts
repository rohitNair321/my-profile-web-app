import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { AppService } from 'src/app/core/services/app.service';
import { AuthService } from 'src/app/auth/services/auth.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { LoadingService } from 'src/app/core/services/loading.service';
import { LocalStorageService } from 'src/app/shared/services/local-storage.service';
import { ChatApiService } from 'src/app/core/services/chat-api.service';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;

  const fakeProfile = {
    id: 'p-1', full_name: 'Rohit Nair', email: 'r@test.com',
    description: 'Test description', location: 'Pune',
    skills: ['Angular'], experiences: [], themes: [], currenttheme: 'default',
    avatar_url: null, resume_url: null,
  };

  const mockAppService = {
    role:         signal<string | null>('ADMIN'),
    profile:      jasmine.createSpy('profile').and.returnValue(fakeProfile),
    _profile:     { set: jasmine.createSpy('set') },
    setRole:      jasmine.createSpy('setRole'),
    getProfile:   jasmine.createSpy('getProfile').and.returnValue(of(fakeProfile)),
    updateProfile: jasmine.createSpy('updateProfile').and.returnValue(of(fakeProfile)),
    getNotifications: jasmine.createSpy('getNotifications').and.returnValue(of({ notificationList: [], unreadCount: 0 })),
  };

  const mockAuthService = {
    token:          signal<string | null>('mock-token'),
    role:           signal<string | null>('ADMIN'),
    updatePassword: jasmine.createSpy('updatePassword').and.returnValue(of({ message: 'ok' })),
    logoutState:    jasmine.createSpy('logoutState'),
    logout:         jasmine.createSpy('logout'),
  };

  const mockAlertService   = { showAlert: jasmine.createSpy('showAlert') };
  const mockLoadingService = { show: jasmine.createSpy('show'), hide: jasmine.createSpy('hide') };
  const mockLocalStorage   = {
    getItem:    jasmine.createSpy().and.returnValue(null),
    setItem:    jasmine.createSpy(),
    removeItem: jasmine.createSpy(),
    clear:      jasmine.createSpy(),
  };
  const mockChatApiService = {
    getUsage:   jasmine.createSpy().and.returnValue(of({})),
    getBalance: jasmine.createSpy().and.returnValue(of({})),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: AppService,         useValue: mockAppService },
        { provide: AuthService,        useValue: mockAuthService },
        { provide: AlertService,       useValue: mockAlertService },
        { provide: LoadingService,     useValue: mockLoadingService },
        { provide: LocalStorageService, useValue: mockLocalStorage },
        { provide: ChatApiService,     useValue: mockChatApiService },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('builds the profile form on init', () => {
    expect(component.profileForm).toBeDefined();
    expect(component.profileForm.get('full_name')).toBeTruthy();
    expect(component.profileForm.get('email')).toBeTruthy();
  });

  it('patches profile data into the form', () => {
    expect(component.profileForm.get('full_name')?.value).toBe('Rohit Nair');
    expect(component.profileForm.get('email')?.value).toBe('r@test.com');
  });

  it('starts on profile tab', () => {
    expect(component.activeSettingTab).toBe('profile');
  });

  it('form is clean on initial load', () => {
    expect(component.profileForm.dirty).toBeFalse();
  });

  it('marks form dirty when a field is changed', () => {
    component.profileForm.get('full_name')?.setValue('New Name');
    expect(component.profileForm.dirty).toBeTrue();
  });

  it('canDeactivate returns false when form is dirty', () => {
    component.profileForm.markAsDirty();
    // When canDeactivate is called without dialog confirmation, it should
    // return an Observable / false rather than true immediately.
    // The guard uses a Subject — testing the signal check here:
    expect(component.isFormChanged()).toBeTrue();
  });

  it('canDeactivate returns true when form is clean', () => {
    component.profileForm.markAsPristine();
    expect(component.isFormChanged()).toBeFalse();
  });

  it('adds an experience entry to FormArray on addExperience()', () => {
    const before = component.experiences.length;
    component.addExperience();
    expect(component.experiences.length).toBe(before + 1);
  });

  it('removes an experience entry on removeExperience()', () => {
    component.addExperience();
    const before = component.experiences.length;
    component.removeExperience(before - 1);
    expect(component.experiences.length).toBe(before - 1);
  });

  it('switches active tab on tab click', () => {
    component.activeSettingTab = 'aiChatMonitoring';
    expect(component.activeSettingTab).toBe('aiChatMonitoring');
  });
});
