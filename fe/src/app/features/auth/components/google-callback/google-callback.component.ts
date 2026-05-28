import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-google-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px">
      @if (error) {
        <p style="color:#e53e3e">{{ error }}</p>
        <a href="/auth/login" style="color:#3182ce">Quay lại đăng nhập</a>
      } @else {
        <div style="width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite"></div>
        <p style="color:#64748b">Đang đăng nhập...</p>
      }
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>
  `,
})
export class GoogleCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  error = '';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const token = params['token'];
    const refresh = params['refresh'];
    const userRaw = params['user'];

    if (!token || !refresh || !userRaw) {
      this.error = 'Đăng nhập Google thất bại. Vui lòng thử lại.';
      return;
    }

    try {
      const user = JSON.parse(userRaw);
      this.authService.handleGoogleCallback(token, refresh, user);
      this.router.navigate(['/calendar']);
    } catch {
      this.error = 'Dữ liệu đăng nhập không hợp lệ.';
    }
  }
}
