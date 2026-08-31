import { Routes } from '@angular/router';
import { adminGuard } from './core/admin.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'wall' },
  {
    path: 'wall',
    data: { flow: 'wall' },
    loadComponent: () =>
      import('./features/wall/wall.component').then((m) => m.WallComponent),
  },
  {
    path: 'pins/:id',
    data: { flow: 'pin-detail' },
    loadComponent: () =>
      import('./features/pin-detail/pin-detail.component').then(
        (m) => m.PinDetailComponent,
      ),
  },
  {
    path: 'login',
    data: { flow: 'login' },
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    data: { flow: 'signup' },
    loadComponent: () =>
      import('./features/auth/signup.component').then((m) => m.SignupComponent),
  },
  { path: 'admin', pathMatch: 'full', redirectTo: 'admin/settings' },
  {
    path: 'admin/settings',
    data: { flow: 'admin-settings' },
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/admin-settings.component').then(
        (m) => m.AdminSettingsComponent,
      ),
  },
  {
    path: '**',
    data: { flow: 'not-found' },
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
