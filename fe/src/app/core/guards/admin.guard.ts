import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('access_token');
  if (!token) return router.createUrlTree(['/auth/login']);

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp as number | undefined;
    if (exp && exp * 1000 < Date.now()) return router.createUrlTree(['/auth/login']);
    if (payload.role === 'admin') return true;
  } catch { /* token malformed */ }

  return router.createUrlTree(['/calendar']);
};
