import { InjectionToken } from '@angular/core';

/**
 * Absolute path prefix for every REST call, e.g. `/api` or `/<preview-id>/api`.
 *
 * The bundle is served both from the site root and from a preview sub-path
 * (`baseHref: "/{{IMAGE_NAME}}/"` in colossus.yaml). HttpClient does NOT honour
 * `<base href>`, so a hardcoded relative `api/pins` would resolve against the
 * *current route* (`/wall` -> `/api/pins`, `/pins/abc` -> `/pins/api/pins`) and a
 * hardcoded absolute `/api/pins` would miss the sub-path entirely. Deriving the
 * prefix from `document.baseURI` gives one string that is correct in both
 * deployments, and mirrors how core/storage.ts namespaces browser storage.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => resolveApiBaseUrl(),
});

export function resolveApiBaseUrl(): string {
  if (typeof document === 'undefined') return '/api';
  try {
    const path = new URL(document.baseURI).pathname;
    // `/` -> `/api`; `/preview-id/` -> `/preview-id/api`.
    return `${path.endsWith('/') ? path.slice(0, -1) : path}/api`;
  } catch {
    return '/api';
  }
}
