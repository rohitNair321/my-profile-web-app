import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environments';

export type HealthStatus = 'ok' | 'warning' | 'error';

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  detail: string;
}

export interface HealthStatusResponse {
  overall: 'healthy' | 'degraded';
  uptime: number;
  checks: HealthCheck[];
}

@Injectable({ providedIn: 'root' })
export class HealthApiService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = environment.baseUrl + '/api/v1/health';

  getStatus() {
    return this.http
      .get<{ data: HealthStatusResponse }>(`${this.baseUrl}/status`, { withCredentials: true })
      .pipe(map(r => r.data));
  }
}
