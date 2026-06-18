import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SharedModule } from '../../shared.module';

import { SidebarComponent } from './sidebar.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [SidebarComponent],
    imports: [SharedModule],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    // Provide a minimal config that the component expects
    component.config = { appConfiguration: { isMobile: false, collapsed: false, type: 'sidebar' }, theme: { name: 'theme-1' } };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
