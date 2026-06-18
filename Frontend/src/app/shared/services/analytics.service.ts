// shared/services/analytics.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environments';

export interface AnalyticsDashboard {
  pageViews: PageView[];
  visitorStats: VisitorStats;
  geographic: GeographicData[];
  devices: DeviceData[];
  traffic: TrafficSource[];
  topPages: TopPage[];
  dateRange: { startDate: string; endDate: string };
}

export interface PageView {
  date: string;
  pageViews: number;
  sessions: number;
}

export interface VisitorStats {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  sessions: number;
  avgSessionDuration: number;
  bounceRate: number;
}

export interface GeographicData {
  country: string;
  city: string;
  users: number;
  sessions: number;
}

export interface DeviceData {
  device: string;
  os: string;
  users: number;
  sessions: number;
}

export interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
}

export interface TopPage {
  path: string;
  title: string;
  pageViews: number;
  avgDuration: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private apiUrl = environment.baseUrl + '/api/v1/analytics';

  // Signals for reactive state
  dashboardData = signal<AnalyticsDashboard | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  /**
   * Get complete analytics dashboard data
   */
  getDashboard(startDate: string = '7daysAgo', endDate: string = 'today'): Observable<any> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .get<any>(`${this.apiUrl}/dashboard`, {
        params: { startDate, endDate },
        withCredentials: true,
      })
      .pipe(
        tap({
          next: (response) => {
            this.dashboardData.set(response.data);
            this.loading.set(false);
          },
          error: (err) => {
            this.error.set(err.message || 'Failed to fetch analytics data');
            this.loading.set(false);
          },
        })
      );
  }

  /**
   * Get page views data
   */
  getPageViews(startDate: string = '7daysAgo', endDate: string = 'today'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/pageviews`, {
      params: { startDate, endDate },
      withCredentials: true,
    });
  }

  /**
   * Get visitor statistics
   */
  getVisitorStats(startDate: string = '7daysAgo', endDate: string = 'today'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/visitors`, {
      params: { startDate, endDate },
      withCredentials: true,
    });
  }

  /**
   * Get geographic data
   */
  getGeographic(startDate: string = '7daysAgo', endDate: string = 'today'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/geographic`, {
      params: { startDate, endDate },
      withCredentials: true,
    });
  }

  /**
   * Get device data
   */
  getDevices(startDate: string = '7daysAgo', endDate: string = 'today'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/devices`, {
      params: { startDate, endDate },
      withCredentials: true,
    });
  }

  /**
   * Get traffic sources
   */
  getTraffic(startDate: string = '7daysAgo', endDate: string = 'today'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/traffic`, {
      params: { startDate, endDate },
      withCredentials: true,
    });
  }

  /**
   * Get top pages
   */
  getTopPages(startDate: string = '7daysAgo', endDate: string = 'today'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/pages`, {
      params: { startDate, endDate },
      withCredentials: true,
    });
  }
}
