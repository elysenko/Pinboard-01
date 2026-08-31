import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Protects the /admin section. In the preview build the guard seeds a session rather
 * than redirecting, so an admin deep link renders on a cold load. It returns exactly
 * one value and never navigates, which makes a guard/shell redirect loop impossible.
 */
export const adminGuard: CanActivateFn = () => {
  inject(AuthService).ensurePreviewSession();
  return true;
};
