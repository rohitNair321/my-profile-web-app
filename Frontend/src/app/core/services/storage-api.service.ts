import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environments';

export interface StorageFile {
  name: string;
  path: string;
  size: number;
  contentType: string;
  createdAt: string | null;
  updatedAt: string | null;
  publicUrl: string;
  /** True when the file is referenced by the app (avatar, resume, post cover…) */
  inUse?: boolean;
  /** Human label of what references it, e.g. "Post: My Angular Deep-Dive" */
  usedBy?: string | null;
}

export interface StorageFilesResponse {
  images: StorageFile[];
  docs: StorageFile[];
  totalImages: number;
  totalDocs: number;
}

@Injectable({ providedIn: 'root' })
export class StorageApiService {
  private readonly http    = inject(HttpClient);
  private readonly baseUrl = environment.baseUrl + '/api/v1/storage';

  listFiles() {
    return this.http
      .get<{ data: StorageFilesResponse }>(`${this.baseUrl}/files`, { withCredentials: true })
      .pipe(map(r => r.data));
  }

  deleteFile(path: string) {
    return this.http.delete(`${this.baseUrl}/files`, {
      params: { path },
      withCredentials: true,
    });
  }
}
