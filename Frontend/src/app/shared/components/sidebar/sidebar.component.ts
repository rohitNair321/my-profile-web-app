import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Input, OnInit, HostListener, Injector, Inject, computed, EventEmitter, Output, PLATFORM_ID } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { RadioButtonModule } from 'primeng/radiobutton';
import { BadgeModule } from 'primeng/badge';
import { defaultConfig, LayoutConfig } from 'src/app/core/config/layout.config';
import { CommonApp } from 'src/app/core/services/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'src/app/core/config/menuItem.config';
import { OverlayBadgeModule } from 'primeng/overlaybadge';

/** Matches app-shell + navigation breakpoint. */
const MOBILE_BREAKPOINT = 900;

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    RadioButtonModule,
    ButtonModule,
    BadgeModule,
    RouterModule,
    OverlayBadgeModule 
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent extends CommonApp implements OnInit {
  // @Input() appConfig;
  isSidebarCollapsed = false;
  isRightSideSettingOpen = false;
  isMobileOpen = false;
  isMobile = false;
  currentSection = '';
  isMenuOpen = false;
  selectedTheme: string = this.appConfig.theme.name;
  @Output() collapseChange = new EventEmitter<boolean>();
  profileData = computed(() => this.appService.profile());
  notifications = computed(() => this.appService.notifications());
  availableThemes = computed(() => {
    const profile = this.profileData();
    return this.normalizeThemesResponse(profile?.themes ?? []);
  });

  // ── Local mirror of config fields for two-way radio bindings ─
  /** ngModel binding for the navigation-type radio group. */
  get navigationType(): string {
    return this.appConfig?.appConfiguration?.type ?? 'sidebar';
  }
  set navigationType(val: string) {
    this.appConfig.appConfiguration.type = val as 'sidebar' | 'navbar';
  }

  /** ngModel binding for the brand-location radio group. */
  get brandLocation(): boolean {
    return this.appConfig?.appConfiguration?.logoLocationHeader ?? false;
  }
  set brandLocation(val: boolean) {
    this.appConfig.appConfiguration.logoLocationHeader = val;
  }

  private readonly _onResize = this._handleResize.bind(this);
  private isBrowser: boolean;

  constructor(
    public override injector: Injector,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    super(injector);
    this.isBrowser = isPlatformBrowser(this.platformId);
  }


  ngOnInit() {
    if (this.isBrowser) {
      this._handleResize();
      window.addEventListener('resize', this._onResize);
    }
  }

  ngOnDestroy() {
    if (this.isBrowser) {
      window.removeEventListener('resize', this.checkMobile.bind(this));
    }
  }

  onThemeChange(theme: any) {
    this.appConfig.theme.name = theme.name;
    this.themeService.setTheme(theme.id);
  }

  checkMobile() {
    this.isMobile = window.innerWidth <= 900;
    if (!this.isMobile) {
      this.isMobileOpen = false;
    }
    this.appConfig.appConfiguration.isMobile = this.isMobile;
  }

  toggleSidebarCollapse() {
    const next = !this.appConfig.appConfiguration.collapsed;
    this.appConfig.appConfiguration.collapsed = next;
    this.collapseChange.emit(next);
  }

  toggleTheme() {
    this.themeToggle();
  }

  toggleMobile() {
    this.isMobileOpen = !this.isMobileOpen;
  }

  toggleMobileMenu() {
    this.isMobileOpen = !this.isMobileOpen;
  }

  onMobileItemClick(event: Event, item: any) {
    event.preventDefault();
    this.scrollToSection(event, item.href);
    this.currentSection = item.label;
    this.isMobileOpen = false;
  }

  toggleSettingSideBar() {
    this.isRightSideSettingOpen = !this.isRightSideSettingOpen;
  }

  onNavigationTypeChange() {
    // navigationType setter already wrote to appConfig.
    // Close panel on mobile to avoid covering the new layout.
    if (this.appConfig.appConfiguration.isMobile) {
      this.isRightSideSettingOpen = false;
    }
  }

  onChangeBrandLocation(brandLocation: boolean) {
    this.appConfig.appConfiguration.logoLocationHeader = brandLocation;
    if (this.appConfig.appConfiguration.isMobile) {
      this.isRightSideSettingOpen = false;
    }
  }

  navigateToNotifications() {
    this.router.navigate(['/admin/notifications']);
  }

  selectTheme(theme: any) {
    this.selectedTheme = theme.name;
    this.onThemeChange(theme);
  }

  onMenuItemClick(item: MenuItem) {
    if (item.actions) {
      item.actions(this.profileData()?.resume_url);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/auth/login']);
  }

  private _handleResize(): void {
    if (!this.isBrowser) return;
    
    const nowMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    if (this.appConfig.appConfiguration.isMobile === nowMobile) { return; }
    this.appConfig.appConfiguration.isMobile = nowMobile;

    // When growing back to desktop, close the mobile overlay
    if (!nowMobile) {
      this.isRightSideSettingOpen = false;
    }
  }
}
