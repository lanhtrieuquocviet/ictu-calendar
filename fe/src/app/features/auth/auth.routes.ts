import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'google-callback',
    loadComponent: () =>
      import('./components/google-callback/google-callback.component').then((m) => m.GoogleCallbackComponent),
  },
];
