import {
  Component,
  HostListener,
  Injector,
  OnInit,
  OnDestroy,
  computed,
 ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { THEME_NAME_MAP } from 'src/app/core/config/theme.config';
import { CommonApp } from 'src/app/core/services/common';
import { ChristmasAnimationComponent } from 'src/app/core/theme/ThemeAnimationsComponent/christmas-animation/christmas-animation.component';
import { NewYearAnimationComponent } from 'src/app/core/theme/ThemeAnimationsComponent/new-year-animation/new-year-animation.component';
import { ChatBotComponent } from 'src/app/shared/components/chat-bot/chat-bot.component';
import { FooterComponent } from 'src/app/shared/components/footer/footer.component';
import { NavigationComponent } from 'src/app/shared/components/navigation/navigation.component';
import { SidebarComponent } from 'src/app/shared/components/sidebar/sidebar.component';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

const MOBILE_BREAKPOINT = 900;

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    FormsModule,
    ChatBotComponent,
    NavigationComponent,
    SidebarComponent,
    FooterComponent,
    ChristmasAnimationComponent,
    NewYearAnimationComponent,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent extends CommonApp implements OnInit, OnDestroy {

  isSettingsPanelOpen = false;

  availableThemes = computed(() =>
    this.normalizeThemesResponse(this.appService.profile()?.themes ?? [])
  );

  constructor(public override injector: Injector, private confirmationService: ConfirmationService) {
    super(injector);

    this.appConfig.theme.name = 'theme-6';
    this.appConfig.appConfiguration.type = 'sidebar';   // 'sidebar' | 'navbar'
    this.appConfig.appConfiguration.theme = 'light';
    this.appConfig.appConfiguration.sidebarPosition = 'left';      // always left
    this.appConfig.appConfiguration.logoLocationHeader = false;       // brand in sidebar
    this.appConfig.appConfiguration.collapsed = true;        // sidebar icon-only by default
    this.appConfig.appConfiguration.showSidebarToggle = true;
    this.appConfig.appConfiguration.showAgentChat = true;
    this.appConfig.appConfiguration.showUserProfileView = this.appService.role() === 'ADMIN';
    this.appConfig.appConfiguration.showNotifications = this.appService.role() === 'ADMIN';
    this.appConfig.appConfiguration.isMobile = this._isMobile();
  }

  // ── Lifecycle ────────────────────────────────────────────────

  ngOnInit(): void {
    const resolvedId = THEME_NAME_MAP[this.appConfig.theme.name ?? 'theme-5'] ?? 'tron';
    this.themeService.setTheme(resolvedId);
    this.startSessionTimer();
    this._applyRoleLayout();
  }

  private _applyRoleLayout(): void {
    const isAdmin = this.appService.role() === 'ADMIN';
    this.appConfig.appConfiguration.type = isAdmin ? 'sidebar' : 'navbar';
    this.appConfig.appConfiguration.showUserProfileView = isAdmin;
    this.appConfig.appConfiguration.showNotifications   = isAdmin;
  }

  ngOnDestroy(): void {
  }

  initSidebarMenu(collapsed: boolean): void {
    this.appConfig.appConfiguration.collapsed = collapsed;
  }

  toggleSettingsPanel(): void {
    this.isSettingsPanelOpen = !this.isSettingsPanelOpen;
  }

  onNavigationTypeChange(type: 'sidebar' | 'navbar'): void {
    this.appConfig.appConfiguration.type = type;

    if (type === 'sidebar') {
      this.appConfig.appConfiguration.collapsed = true;
    }

    if (this.appConfig.appConfiguration.isMobile) {
      this.isSettingsPanelOpen = false;
    }
  }

  onBrandLocationChange(inHeader: boolean): void {
    this.appConfig.appConfiguration.logoLocationHeader = inHeader;

    if (this.appConfig.appConfiguration.isMobile) {
      this.isSettingsPanelOpen = false;
    }
  }

  onThemeChange(theme: { id: string; name: string }): void {
    this.appConfig.theme.name = theme.name;
    this.themeService.setTheme(theme.id);
  }

  @HostListener('window:resize')
  onResize(): void {
    const wasMobile = this.appConfig.appConfiguration.isMobile;
    const nowMobile = this._isMobile();

    if (wasMobile === nowMobile) { return; }   // no state change — skip

    this.appConfig.appConfiguration.isMobile = nowMobile;

    if (nowMobile) {
      this.appConfig.appConfiguration.collapsed = true;
    }
  }

  // ── Private helpers ───────────────────────────────────────────

  private _isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
  }

  startSessionTimer() {
    if (this.appService.role() !== 'ADMIN') {
      setTimeout(() => {
        this.confirmationService.confirm({
          header: 'App session expiring',
          message: 'Your session is about to expire. Do you want to refresh the session?',
          acceptLabel: 'Ok',
          acceptIcon: "none",
          rejectVisible: false,
          closeOnEscape: false,
          closable: false,
          accept: () => {
            window.location.reload();
          },
        });
      }, 10 * 60 * 1000);
    }
  }
}