import { Routes } from '@angular/router';
import { adminGuard } from '@core/guards/admin.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./components/user-management/user-management.component').then(
        (m) => m.UserManagementComponent,
      ),
  },
];
