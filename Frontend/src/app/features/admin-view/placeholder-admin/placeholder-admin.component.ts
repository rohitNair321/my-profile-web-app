import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

const ICON_MAP: Record<string, string> = {
  overview: 'dashboard',
  profile: 'person',
  experience: 'work',
  projects: 'folder_special',
  skills: 'psychology',
  themes: 'palette',
  blog: 'article',
  about: 'edit_note',
  notifications: 'notifications',
  ai: 'smart_toy',
  analytics: 'bar_chart',
  security: 'security',
  social: 'share',
};

const LABEL_MAP: Record<string, string> = {
  overview: 'Overview',
  profile: 'Profile',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Skills',
  themes: 'Themes',
  blog: 'Learning Posts',
  about: 'About Me',
  notifications: 'Notifications',
  ai: 'AI Usage',
  analytics: 'Analytics',
  security: 'Security',
  social: 'Social Links',
};

@Component({
  selector: 'app-placeholder-admin',
  standalone: true,
  imports: [],
  template: `
    <div class="ph-wrap">
      <div class="ph-icon">
        <span class="material-icons">{{ icon }}</span>
      </div>
      <div class="ph-title">{{ label }}</div>
      <p class="ph-body">
        This page is under construction as part of the V2 admin redesign.<br>
        Visit <strong>Overview</strong>, <strong>Profile (Settings)</strong>,
        or <strong>Notifications</strong> to interact with live admin features.
      </p>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ph-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      gap: 1rem;
      text-align: center;
      padding: 2rem;
      animation: phFade 0.3s ease;
    }
    .ph-icon {
      width: 72px;
      height: 72px;
      background: rgba(99, 102, 241, 0.1);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      .material-icons { font-size: 2rem; color: #6366F1; opacity: 0.65; }
    }
    .ph-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: #94A3B8;
    }
    .ph-body {
      font-size: 0.875rem;
      color: #475569;
      max-width: 320px;
      line-height: 1.65;
      strong { color: #E2E8F0; }
    }
    @keyframes phFade {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class PlaceholderAdminComponent implements OnInit {
  icon = 'construction';
  label = 'Coming Soon';

  constructor(private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.route.data.subscribe(d => {
      const page = d['page'] as string;
      if (page) {
        this.icon = ICON_MAP[page] ?? 'pages';
        this.label = LABEL_MAP[page] ?? page;
      }
    });
  }
}
