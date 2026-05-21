import { Routes } from '@angular/router';
import { adminGuard } from '@core/guards/admin.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./components/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/user-management/user-management.component').then(
            m => m.UserManagementComponent,
          ),
      },
      {
        path: 'departments',
        loadComponent: () =>
          import('./components/department-management/department-management.component').then(
            m => m.DepartmentManagementComponent,
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./components/category-management/category-management.component').then(
            m => m.CategoryManagementComponent,
          ),
      },
    ],
  },
];
