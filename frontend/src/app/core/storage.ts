/**
 * Namespaced browser storage.
 *
 * Previews are served many-per-origin under `/<preview-id>/`, and browser storage is
 * origin-scoped rather than path-scoped. Every key is therefore prefixed with the
 * deployment's first path segment (`<preview-id>:user`) so two previews open in the
 * same browser cannot clobber each other. Reads fall back to the bare key so a
 * root-served deployment keeps working.
 */
const APP_SEGMENTS = ['wall', 'pins', 'login', 'signup', 'admin'];

export function storageNamespace(): string {
  if (typeof location === 'undefined') return 'app';
  const seg = (location.pathname.split('/')[1] || '').trim();
  return !seg || APP_SEGMENTS.includes(seg) ? 'app' : seg;
}

const nsKey = (key: string): string => `${storageNamespace()}:${key}`;

/** Raw read: namespaced key first, bare key as a fallback for root-served deployments. */
export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(nsKey(key)) ?? localStorage.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/**
 * Distinguishes "absent" from "present but unreadable" so callers can clear corrupt
 * values instead of silently leaving them to fail on every future load.
 */
export function readJson<T>(key: string): { present: boolean; value: T | null } {
  const raw = readRaw(key);
  if (raw === null) return { present: false, value: null };
  try {
    return { present: true, value: JSON.parse(raw) as T };
  } catch {
    return { present: true, value: null };
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(nsKey(key), JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — the app stays usable without it */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(nsKey(key));
    localStorage.removeItem(key);
  } catch {
    /* nothing to clean up */
  }
}
