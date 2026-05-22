import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(attachToken(req, authService.getToken())).pipe(
    catchError((err: HttpErrorResponse) => {
      // Chỉ xử lý 401, và không retry chính endpoint refresh (tránh vòng lặp)
      if (err.status !== 401 || isAuthEndpoint(req.url)) {
        return throwError(() => err);
      }

      const refreshToken = authService.getRefreshToken();
      if (!refreshToken) {
        authService.logout();
        return throwError(() => err);
      }

      // Gọi refresh, sau đó retry request gốc với access_token mới
      return authService.refreshToken().pipe(
        switchMap(() => next(attachToken(req, authService.getToken()))),
        catchError((refreshErr) => {
          // Refresh thất bại → đăng xuất
          authService.logout();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};

function attachToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token) return req;
  return req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) });
}

function isAuthEndpoint(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');
}
