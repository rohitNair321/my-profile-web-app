import { Injectable, Injector } from "@angular/core";
import { AuthService } from "src/app/auth/services/auth.service";
import { LoadingService } from "./loading.service";
import { defaultConfig, LayoutConfig } from "../config/layout.config";
import { AppService } from "./app.service";
import { ThemeService } from "../theme/theme.service";
import { AlertService } from "./alert.service";
import { ActivatedRoute, Router } from "@angular/router";
import { LocalStorageService } from "src/app/shared/services/local-storage.service";
import { MenuItem } from "../config/menuItem.config";
import { ChatApiService } from "./chat-api.service";

@Injectable({ providedIn: 'root' })
export class CommonApp {

  public loading;
  public authService;
  public appService;
  public themeService;
  public alertService;
  public router;
  public route;
  public localStorageService;
  public aiChatService;
  public appConfig: LayoutConfig = defaultConfig;
  public menuItems: MenuItem[] = [];

  constructor(public injector: Injector) {
    this.loading = this.injector.get(LoadingService);
    this.authService = this.injector.get(AuthService);
    this.appService = this.injector.get(AppService);
    this.alertService = this.injector.get(AlertService);
    this.themeService = this.injector.get(ThemeService);
    this.router = this.injector.get(Router);
    this.route = this.injector.get(ActivatedRoute);
    this.localStorageService = this.injector.get(LocalStorageService);
    this.aiChatService = this.injector.get(ChatApiService);

    this.menuItems = [
      new MenuItem({ label: 'Home', key: 'home', href: '#home', icon: 'home' }),
      new MenuItem({ label: 'About Me', key: 'aboutMe', href: '#about', icon: 'person' }),
      new MenuItem({ label: 'Projects', key: 'projects', href: '#projects', icon: 'work' }),
      new MenuItem({ label: 'Posts', key: 'posts', routerLink: '/posts', icon: 'article', isHide: true }),
      new MenuItem({ label: 'Contact', key: 'contact', href: '#contact', icon: 'mail' }),
      new MenuItem({ label: 'Notifications', routerLink: '/admin/notifications', icon: 'notifications', key: 'notifications', isHide: this.appConfig.appConfiguration.showNotifications,  role: 'admin' }),
      new MenuItem({
        label: 'Resume', icon: 'download', action: true, key: 'resume', tooltip: 'Download Resume', actions: (event) => {
          this.downloadResume(event);
        }
      }),

      // new MenuItem({
      //   label: 'Admin',
      //   key: 'admin',
      //   icon: 'dashboard_customize',
      //   expanded: false,
      //   subMenu: [
      //     new MenuItem({ label: 'Dashboard', key: 'dashboard', routerLink: '/admin/dashboard', icon: 'dashboard' }),
      //     new MenuItem({ label: 'Settings', key: 'settings', routerLink: '/admin/settings', icon: 'settings' })
      //   ]
      // }),
    ];
  }

  public themeToggle() {
    this.themeService.toggleDarkMode();
  }

  /**
   * Scrolls the window to a specific section smoothly
   * @param event The mouse event to prevent default anchor behavior
   * @param target The ID of the element (e.g., '#home')
   */
  scrollToSection(event: Event, target: string): void {
    event.preventDefault();
    const element = document.querySelector(target);

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }

  public normalizeThemesResponse(raw: any): any[] {
    // 1. Handle stringified input from DB
    let data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data) return [];

    // 2. If it's an object with keys (your current "corrupted" state), convert to clean array
    if (!Array.isArray(data) && typeof data === 'object') {
      return Object.entries(data).map(([key, value]: [string, any]) => {
        const isNested = value && typeof value === 'object' && !value.tokens;
        const themeData = isNested ? Object.values(value)[0] : value;
        const actualId = isNested ? Object.keys(value)[0] : key;

        return {
          id: actualId,
          ...themeData
        };
      }).filter(t => t.name); // Remove empty entries
    }

    // 3. If it's already a clean array, just return it
    return Array.isArray(data) ? data : [];
  }

  applyThemeFromProfile(profile: any) {
    if (!profile) return;
    const themeList = this.normalizeThemesResponse(profile.themes);
    this.themeService.registerThemes(themeList);

    if (themeList.length === 0) return;

    // Look up by ID first (current format), then by name (legacy format), then fall back to first theme
    const resolved = themeList.find((t: any) => t.id === profile.currenttheme)
      ?? themeList.find((t: any) => t.name === profile.currenttheme)
      ?? themeList[0];

    this.themeService.setTheme(resolved.id);
  }

  downloadResume(resumeUrl: any) {
    fetch(resumeUrl)
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = 'Rohit_Resume.pdf';
        a.click();
        URL.revokeObjectURL(objectUrl);
      });
  }

  // Add this utility to your CommonApp class or a helper file
  decodeHtml(html: string): string {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    // We call it twice because your string has multiple layers of &amp;
    let decoded = txt.value;
    while (decoded.includes('&')) {
      txt.innerHTML = decoded;
      decoded = txt.value;
    }
    return decoded;
  }

  openLink(event?: MouseEvent, link?: string) {
    if (!link) {
      event?.preventDefault();
      event?.stopPropagation();
    }
    const url = this.decodeHtml(link || '');
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  isMenuHandler() {

  }

  navigitaionActions(routerLink?: string) {
    this.router.navigate([routerLink]);
  }
}
