import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  loading = false;
  error = '';
  showPassword = signal(false);

  get emailCtrl() { return this.form.controls.email; }
  get passwordCtrl() { return this.form.controls.password; }

  get emailError(): string {
    const c = this.emailCtrl;
    if (!c.touched) return '';
    if (c.hasError('required')) return 'Email không được để trống.';
    if (c.hasError('email')) return 'Email không đúng định dạng.';
    return '';
  }

  get passwordError(): string {
    const c = this.passwordCtrl;
    if (!c.touched) return '';
    if (c.hasError('required')) return 'Mật khẩu không được để trống.';
    if (c.hasError('minlength')) return 'Mật khẩu tối thiểu 6 ký tự.';
    return '';
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  loginWithGoogle(): void {
    this.authService.loginWithGoogle();
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    this.authService.login(this.form.value as any).subscribe({
      next: () => this.router.navigate(['/calendar']),
      error: (err) => {
        const msg = err.error?.message;
        this.error = typeof msg === 'string' ? msg : 'Email hoặc mật khẩu không chính xác.';
        this.loading = false;
      },
    });
  }
}
