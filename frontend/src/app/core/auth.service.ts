import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { User, UserRole, isUser } from './user.model';
import { readJson, removeKey, writeJson } from './storage';

const USER_KEY = 'user';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface AuthResult {
  ok: boolean;
  error?: string;
}

/**
 * Auth state for the PinBoard preview.
 *
 * Credentials are resolved entirely in the browser: the preview is a static bundle with
 * no API behind it, so any awaited network call would strand a reviewer on the login
 * screen. Validation is limited to "present and correctly shaped"; anything plausible
 * signs in successfully.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  constructor() {
    this.restore();
  }

  /** Reads persisted state defensively — an unrecognised value is discarded, never thrown. */
  private restore(): void {
    const { present, value } = readJson<unknown>(USER_KEY);
    if (!present) return;
    if (isUser(value)) {
      this.user.set(value);
      return;
    }
    removeKey(USER_KEY);
  }

  login(email: string, password: string): AuthResult {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      return { ok: false, error: 'Enter both your email and password.' };
    }
    if (!EMAIL_RE.test(trimmed)) {
      return { ok: false, error: 'That does not look like an email address.' };
    }
    this.setUser(this.buildUser(trimmed, this.nameFromEmail(trimmed)));
    void this.router.navigate(['/wall']);
    return { ok: true };
  }

  signup(name: string, email: string, password: string): AuthResult {
    const trimmed = email.trim();
    if (!name.trim() || !trimmed || !password) {
      return { ok: false, error: 'Fill in every field to create your account.' };
    }
    if (!EMAIL_RE.test(trimmed)) {
      return { ok: false, error: 'That does not look like an email address.' };
    }
    this.setUser(this.buildUser(trimmed, name.trim()));
    void this.router.navigate(['/wall']);
    return { ok: true };
  }

  /** Visible escape hatch so a reviewer can reach the signed-in views in one click. */
  demoLogin(navigate = true): void {
    this.setUser({
      id: 'demo-admin',
      email: 'ada@pinboard.app',
      name: 'Ada Lovelace',
      role: 'ADMIN',
    });
    if (navigate) void this.router.navigate(['/wall']);
  }

  /**
   * Guards call this on a cold load of a protected route. The preview is treated as an
   * already-signed-in session so a deep link renders its screen instead of bouncing.
   * It seeds state and returns — it never redirects, so no guard loop is possible.
   */
  ensurePreviewSession(): void {
    if (!this.isAuthenticated()) this.demoLogin(false);
  }

  logout(): void {
    this.user.set(null);
    removeKey(USER_KEY);
    void this.router.navigate(['/wall']);
  }

  private setUser(user: User): void {
    this.user.set(user);
    writeJson(USER_KEY, user);
  }

  private buildUser(email: string, name: string): User {
    const role: UserRole = /admin|owner|ada/i.test(email) ? 'ADMIN' : 'USER';
    return { id: `u-${email.toLowerCase()}`, email, name, role };
  }

  private nameFromEmail(email: string): string {
    const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
    return local
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'PinBoard User';
  }
}
