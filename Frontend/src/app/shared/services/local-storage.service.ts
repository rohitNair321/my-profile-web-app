import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // Helper to safely access storage
  private get storage(): Storage | null {
    return this.isBrowser ? window.localStorage : null;
  }

  getItem(key: string): string | null {
    return this.storage ? this.storage.getItem(key) : null;
  }

  setItem(key: string, value: string): void {
    if (this.storage) {
      this.storage.setItem(key, value);
    }
  }

  removeItem(key: string): void {
    if (this.storage) {
      this.storage.removeItem(key);
    }
  }

  clear(): void {
    if (this.storage) {
      this.storage.clear();
    }
  }
}