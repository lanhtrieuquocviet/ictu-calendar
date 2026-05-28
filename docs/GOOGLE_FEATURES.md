# Google Login & Google Calendar Sync — Kế hoạch triển khai

## Tổng quan

| Tính năng | Trạng thái | Phụ thuộc |
|-----------|-----------|-----------|
| Đăng nhập bằng Google (OAuth2) | Đang triển khai | Google Cloud Console credentials |
| Đồng bộ Google Calendar (1 chiều) | Đang triển khai | Google Login phải hoạt động trước |

---

## Chuẩn bị: Google Cloud Console

1. Truy cập [console.cloud.google.com](https://console.cloud.google.com)
2. Tạo project mới hoặc chọn project có sẵn
3. Vào **APIs & Services → Enable APIs** → bật:
   - **Google+ API** (cho login)
   - **Google Calendar API** (cho đồng bộ)
4. Vào **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs**
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback` (dev), thêm URL production khi deploy
5. Copy **Client ID** và **Client Secret** vào file `.env`

### Biến môi trường cần thêm vào `.env`

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
FRONTEND_URL=http://localhost:4200
```

---

## Phase 1: Đăng nhập bằng Google

### Luồng hoạt động

```
[FE] Bấm "Đăng nhập Google"
    → redirect đến GET /auth/google (backend)
    → backend redirect đến Google OAuth
    → user chọn tài khoản Google
    → Google redirect về GET /auth/google/callback
    → backend tạo JWT + redirect về FE: /auth/google-callback?token=...&refresh=...
    → FE lưu token, điều hướng vào /calendar
```

### Các file thay đổi (Backend)

| File | Thay đổi |
|------|---------|
| `user.entity.ts` | Thêm `googleId` (nullable, unique), `password` → nullable |
| `auth/strategies/google.strategy.ts` | **Tạo mới** — GoogleStrategy với scope profile + email + calendar |
| `common/guards/google-oauth.guard.ts` | **Tạo mới** — guard dùng cho route redirect |
| `auth/auth.service.ts` | Thêm `googleLogin(googleUser)` |
| `auth/auth.module.ts` | Đăng ký GoogleStrategy |
| `auth/auth.controller.ts` | Thêm `/auth/google` và `/auth/google/callback` |

### Các file thay đổi (Frontend)

| File | Thay đổi |
|------|---------|
| `login.component.html` | Thêm nút "Đăng nhập bằng Google" |
| `login.component.ts` | Thêm `loginWithGoogle()` — redirect đến backend |
| `auth/auth.routes.ts` | Thêm route `google-callback` |
| `auth/components/google-callback/` | **Tạo mới** — đọc token từ URL, lưu session |
| `core/services/auth.service.ts` | Thêm `handleGoogleCallback()` |

---

## Phase 2: Đồng bộ Google Calendar

### Luồng hoạt động

```
[FE] Bấm "Đồng bộ Google Calendar" (trong profile hoặc calendar view)
    → POST /calendar/sync-google (kèm JWT)
    → backend lấy Google token của user từ DB
    → gọi Google Calendar API, tạo events từ hệ thống
    → trả về số events đã đồng bộ
```

### Các file thay đổi (Backend)

| File | Thay đổi |
|------|---------|
| `calendar/entities/google-token.entity.ts` | **Tạo mới** — lưu accessToken + refreshToken per user |
| `calendar/google-calendar.service.ts` | **Tạo mới** — gọi Google Calendar API |
| `calendar/calendar.module.ts` | Đăng ký GoogleToken entity + GoogleCalendarService |
| `calendar/calendar.controller.ts` | Thêm `POST /calendar/sync-google` |

### Lưu ý quan trọng

- Scope OAuth phải bao gồm `https://www.googleapis.com/auth/calendar` ngay từ bước đăng nhập
- `refreshToken` chỉ được trả về lần đầu đăng nhập, cần lưu ngay
- Nếu access token hết hạn, dùng refresh token để lấy token mới tự động
- Đây là đồng bộ **1 chiều**: hệ thống → Google Calendar (không kéo từ Google về)

---

## Kiến trúc Google Token Entity

```
google_tokens
├── id (uuid, PK)
├── userId (uuid, FK → users.id, unique)
├── accessToken (text)
├── refreshToken (text, nullable — chỉ có lần đầu)
├── tokenExpiry (datetime)
└── updatedAt
```
