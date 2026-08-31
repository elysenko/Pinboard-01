import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { toApiError } from './http-errors';
import { ServiceSetting, SettingEntry } from './setting.model';

/**
 * Admin credential settings, backed by `GET|PATCH /api/admin/settings`.
 *
 * Both routes are admin-guarded server-side, so every call here carries the bearer
 * token added by the auth interceptor and fails with a 401/403 without one.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/admin/settings`;

  /** The provisioned services with masked values and per-field `configured` flags. */
  async list(): Promise<ServiceSetting[]> {
    try {
      return await firstValueFrom(this.http.get<ServiceSetting[]>(this.url));
    } catch (error) {
      throw toApiError(error);
    }
  }

  /**
   * Upserts credential values and returns the refreshed list, so the badges and the
   * "needs credentials" banner reflect what the server actually stored rather than
   * what the form hoped it stored.
   *
   * Only pass entries the admin actually edited: values arrive masked, and echoing
   * a masked string back would persist the dots as the real credential.
   */
  async save(entries: SettingEntry[]): Promise<ServiceSetting[]> {
    try {
      return await firstValueFrom(
        this.http.patch<ServiceSetting[]>(this.url, entries),
      );
    } catch (error) {
      throw toApiError(error);
    }
  }
}
