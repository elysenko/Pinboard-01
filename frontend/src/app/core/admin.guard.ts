import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Protects the /admin section.
 *
 * The backend is the real authority — every `/api/admin/*` route is behind
 * JwtAuthGuard + RolesGuard — so this only decides which screen to show.
 *
 * It deliberately does NOT open a session on the visitor's behalf. The preview
 * build fabricated an admin user here so a cold deep link would render, but now
 * that sessions are real that would hand a live admin token to anyone who typed
 * the URL. An unauthenticated visitor is sent to /login instead, where the
 * "Skip login — Demo Mode" button is the sanctioned one-click way in.
 *
 * By the time this runs, the APP_INITIALIZER in app.config.ts has already
 * revalidated any stored token, so these signals reflect what the server accepts.
 * It returns exactly one value and never loops.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAdmin()) return true;
  return router.createUrlTree([auth.isAuthenticated() ? '/wall' : '/login']);
};
