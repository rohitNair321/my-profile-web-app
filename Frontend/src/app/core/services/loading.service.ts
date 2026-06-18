import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  // signal is reactive like BehaviorSubject but simpler
  isLoading = signal(false);
  loadingMessage = signal<string | null>(null);

  show(message: string | null = null): void {
    this.isLoading.set(true);
    this.loadingMessage.set(message);
  }

  hide(): void {
    this.isLoading.set(false);
  }
}
