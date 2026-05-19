import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'calendar',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'calendar',
    loadChildren: () =>
      import('./features/calendar/calendar.routes').then((m) => m.calendarRoutes),
  },
  {
    path: '**',
    redirectTo: 'calendar',
  },
];
