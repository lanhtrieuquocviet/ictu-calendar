import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { departmentGuard } from '@core/guards/department.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'calendar',
    pathMatch: 'full',
  },
  {
    path: 'select-department',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/select-department/select-department.component').then(
        m => m.SelectDepartmentComponent
      ),
  },
  {
    path: 'profile',
    canActivate: [authGuard, departmentGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then(m => m.ProfileComponent),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'calendar',
    canActivate: [departmentGuard],
    loadChildren: () =>
      import('./features/calendar/calendar.routes').then((m) => m.calendarRoutes),
  },
  {
    path: 'admin',
    canActivate: [authGuard, departmentGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'notifications',
    canActivate: [authGuard, departmentGuard],
    loadChildren: () =>
      import('./features/notifications/notifications.routes').then((m) => m.notificationsRoutes),
  },
  {
    path: '**',
    redirectTo: 'calendar',
  },
];
