import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { toApiError } from './http-errors';
import { readJson, removeKey, writeJson } from './storage';
import { TokenStore } from './token-store';
import { User, UserRole, isUser } from './user.model';

const USER_KEY = 'user';

/** The shape `POST /api/auth/login|signup` returns (see backend AuthService). */
interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; name: string; role: UserRole };
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

/**
 * Credentials seeded by `backend/prisma/seed.ts` for the bundled admin account.
 * The seed derives the password deterministically from the email plus SEED_SECRET,
 * so this pair is stable across boots and lets "Skip login — Demo Mode" open a real
 * server session (a real JWT, real admin data) instead of a fabricated local one.
 * If an instance overrides SEED_SECRET the login simply fails and the form reports it.
 */
const DEMO_EMAIL = 'admin@example.com';
const DEMO_PASSWORD = '0f4c03eb2e8ce5ac';

/**
 * Session state, backed by the live API.
 *
 * The token lives in TokenStore (the interceptor reads it there); the user record is
 * mirrored into browser storage so a reload paints the signed-in nav immediately,
 * then revalidated against `GET /api/auth/me` so a stale or revoked token cannot
 * leave the UI claiming a session the server will reject.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokens = inject(TokenStore);
  private readonly base = `${inject(API_BASE_URL)}/auth`;

  readonly user = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  constructor() {
    this.restoreCachedUser();
    // The interceptor clears the token on any 401. Mirroring that into the user
    // signal keeps the header, the tab bar and the guards from advertising a
    // session the server has already rejected.
    effect(() => {
      const token = this.tokens.token();
      // `untracked` so this effect depends on the token alone. Reading the user
      // signal as a dependency would make the write below re-trigger the effect.
      if (token === null && untracked(this.user) !== null) {
        this.user.set(null);
        removeKey(USER_KEY);
      }
    });
  }

  /** Paints the cached user instantly; `revalidate()` confirms it against the server. */
  private restoreCachedUser(): void {
    if (this.tokens.token() === null) {
      removeKey(USER_KEY);
      return;
    }
    const { present, value } = readJson<unknown>(USER_KEY);
    if (!present) return;
    if (isUser(value)) this.user.set(value);
    else removeKey(USER_KEY);
  }

  /**
   * Confirms the stored token still works. Called once at bootstrap, before the
   * first route renders. A failure is not an error state: it just means "signed
   * out", so the app carries on and shows the public wall.
   */
  async revalidate(): Promise<void> {
    if (this.tokens.token() === null) return;
    try {
      const me = await firstValueFrom(
        this.http.get<AuthResponse['user']>(`${this.base}/me`),
      );
      this.setUser(me);
    } catch {
      // A 401 already cleared the token via the interceptor; any other failure
      // (server down) should not strand the user, so just drop the session.
      this.clearSession();
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      return { ok: false, error: 'Enter both your email and password.' };
    }
    return this.authenticate('login', { email: trimmed, password }, true);
  }

  async signup(name: string, email: string, password: string): Promise<AuthResult> {
    const trimmed = email.trim();
    if (!name.trim() || !trimmed || !password) {
      return { ok: false, error: 'Fill in every field to create your account.' };
    }
    return this.authenticate(
      'signup',
      { name: name.trim(), email: trimmed, password },
      true,
    );
  }

  /**
   * Visible escape hatch so a reviewer can reach the signed-in views in one click.
   * Unlike the preview build this performs a real login, so the admin screens it
   * unlocks are backed by real data from `/api/admin/settings`.
   */
  async demoLogin(navigate = true): Promise<AuthResult> {
    return this.authenticate(
      'login',
      { email: DEMO_EMAIL, password: DEMO_PASSWORD },
      navigate,
    );
  }

  logout(): void {
    const hadToken = this.tokens.token() !== null;
    // Tokens are stateless, so the server call is advisory — the session is over
    // the moment the token is dropped locally. Fire it without awaiting so logging
    // out never blocks on a slow or unreachable API.
    if (hadToken) {
      firstValueFrom(this.http.post(`${this.base}/logout`, {})).catch(() => undefined);
    }
    this.clearSession();
    void this.router.navigate(['/wall']);
  }

  private async authenticate(
    path: 'login' | 'signup',
    body: Record<string, string>,
    navigate: boolean,
  ): Promise<AuthResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.base}/${path}`, body),
      );
      this.tokens.set(response.accessToken);
      this.setUser(response.user);
      if (navigate) await this.router.navigate(['/wall']);
      return { ok: true };
    } catch (error) {
      const apiError = toApiError(error);
      return { ok: false, error: this.messageFor(path, apiError.status, apiError.message) };
    }
  }

  /** Server wording is precise but terse; these read better under the form. */
  private messageFor(path: 'login' | 'signup', status: number, fallback: string): string {
    if (status === 401) return 'That email and password do not match an account.';
    if (status === 409) return 'An account with that email already exists.';
    if (status === 0) {
      return path === 'login'
        ? 'Could not reach the board to sign you in. Check your connection.'
        : 'Could not reach the board to create your account. Check your connection.';
    }
    return fallback;
  }

  private setUser(user: AuthResponse['user']): void {
    const stored: User = {
      id: user.id,
      email: user.email,
      // The API allows a null name; the nav renders an initial from it, so fall
      // back to the email's local part rather than rendering an empty chip.
      name: user.name?.trim() || this.nameFromEmail(user.email),
      role: user.role,
    };
    this.user.set(stored);
    writeJson(USER_KEY, stored);
  }

  private clearSession(): void {
    this.tokens.clear();
    this.user.set(null);
    removeKey(USER_KEY);
  }

  private nameFromEmail(email: string): string {
    const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
    return (
      local
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') || 'PinBoard User'
    );
  }
}
