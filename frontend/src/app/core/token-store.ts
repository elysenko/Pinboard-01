import { Injectable, signal } from '@angular/core';
import { readRaw, removeKey, writeJson } from './storage';

const TOKEN_KEY = 'accessToken';

/**
 * Holds the bearer token issued by `POST /api/auth/login`.
 *
 * It is deliberately separate from AuthService: the HTTP interceptor needs the token
 * on every request, and AuthService needs HttpClient — injecting one into the other
 * would close a DI cycle. This service depends on nothing.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  /** A signal so anything reading it re-evaluates when the session changes. */
  readonly token = signal<string | null>(null);

  constructor() {
    const raw = readRaw(TOKEN_KEY);
    if (raw === null) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'string' && parsed.length > 0) this.token.set(parsed);
      else removeKey(TOKEN_KEY);
    } catch {
      removeKey(TOKEN_KEY);
    }
  }

  set(token: string): void {
    this.token.set(token);
    writeJson(TOKEN_KEY, token);
  }

  clear(): void {
    this.token.set(null);
    removeKey(TOKEN_KEY);
  }
}
