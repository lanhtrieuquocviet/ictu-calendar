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
  {
    path: 'categories',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./components/category-management/category-management.component').then(
        (m) => m.CategoryManagementComponent,
      ),
  },
];
