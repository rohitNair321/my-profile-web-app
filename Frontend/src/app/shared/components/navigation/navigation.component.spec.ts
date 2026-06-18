import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SharedModule } from '../../../shared.module';

import { NavigationComponent } from './navigation.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('NavigationComponent', () => {
  let component: NavigationComponent;
  let fixture: ComponentFixture<NavigationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [NavigationComponent],
    imports: [RouterTestingModule,
        SharedModule],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();

    fixture = TestBed.createComponent(NavigationComponent);
    component = fixture.componentInstance;
  // provide minimal config expected by the component
  component.config = { appConfiguration: { type: 'sidebar', sidebarPosition: 'left', collapsed: false, isMobile: false, theme: 'light' }, theme: { name: 'theme-1' } };
  fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
