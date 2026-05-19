import { Routes } from '@angular/router';

export const calendarRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/calendar-view/calendar-view.component').then(
        (m) => m.CalendarViewComponent,
      ),
  },
];
