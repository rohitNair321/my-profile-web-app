import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private titleService = inject(Title);
  private meta = inject(Meta);
  private platformId = inject(PLATFORM_ID);

  private readonly BASE_TITLE = 'Rohit Nair — Full Stack Developer';
  private readonly BASE_URL = 'https://www.mintpixel.in';

  set(config: SeoConfig): void {
    const fullTitle = config.title === this.BASE_TITLE
      ? config.title
      : `${config.title} | Rohit Nair`;

    this.titleService.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: config.description });

    if (config.keywords) {
      this.meta.updateTag({ name: 'keywords', content: config.keywords });
    }

    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: config.description });
    this.meta.updateTag({ property: 'og:url', content: config.url ?? this.BASE_URL });
    this.meta.updateTag({ property: 'og:type', content: 'website' });

    if (config.image) {
      this.meta.updateTag({ property: 'og:image', content: config.image });
    }

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: config.description });

    if (isPlatformBrowser(this.platformId)) {
      this.setCanonical(config.url ?? this.BASE_URL);
    }
  }

  private setCanonical(url: string): void {
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
