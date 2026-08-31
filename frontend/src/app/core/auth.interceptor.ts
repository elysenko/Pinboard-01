import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { TokenStore } from './token-store';

/**
 * Attaches the bearer token to our own API calls and drops the session on a 401.
 *
 * The token is only added to same-origin `/api/*` URLs so a future call to a
 * third-party host can never leak it. Public routes (`/api/pins`, `/api/health`)
 * ignore the header, so sending it unconditionally is harmless.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStore);
  const apiBase = inject(API_BASE_URL);

  const isOwnApi = req.url.startsWith(apiBase) || req.url.startsWith('/api/');
  const token = tokens.token();
  const authorised =
    isOwnApi && token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authorised).pipe(
    catchError((error: unknown) => {
      // A 401 means the token is gone, expired or revoked. Clearing it here — rather
      // than in every caller — guarantees the nav and guards agree with the server.
      // The login endpoint is excluded: a wrong password must not look like an
      // expired session.
      const isLoginAttempt = req.url.includes('/auth/login') || req.url.includes('/auth/signup');
      if (error instanceof HttpErrorResponse && error.status === 401 && !isLoginAttempt) {
        tokens.clear();
      }
      return throwError(() => error);
    }),
  );
};
