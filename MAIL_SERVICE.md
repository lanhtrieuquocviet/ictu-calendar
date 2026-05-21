# MAIL SERVICE — Hướng dẫn cấu hình & sử dụng

## Tổng quan kiến trúc

```
Tạo / Sửa / Duyệt sự kiện
        │
        ▼
CalendarService
        │ resolveRecipients()
        ▼
┌───────────────────────────────────┐
│     EventParticipant              │
│  type=USER  → lấy email từ users  │
│  type=DEPT  → lấy email toàn phòng│
│  type=EXT   → dùng email tự nhập  │
└───────────────────────────────────┘
        │
        ▼
NotificationService (Nodemailer + Gmail SMTP)
        │
        ▼
   Gmail → Người nhận
```

---

## 1. Cấu hình Gmail SMTP (bắt buộc trước khi bật)

### Bước 1 — Bật 2-Factor Authentication cho Gmail

Vào [myaccount.google.com/security](https://myaccount.google.com/security) → bật **Xác minh 2 bước**.

### Bước 2 — Tạo App Password

1. Vào [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Chọn **App**: `Mail` | **Device**: `Other (Custom name)` → đặt tên `ICTU Calendar`
3. Click **Generate** → copy mật khẩu 16 ký tự (VD: `abcd efgh ijkl mnop`)

### Bước 3 — Điền vào `.env`

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASS=abcdefghijklmnop   # App Password, KHÔNG dùng mật khẩu Gmail thông thường
```

> **Lưu ý bảo mật:** Không commit file `.env` lên git. File `.env` đã có trong `.gitignore`.

---

## 2. Khi nào mail được gửi?

| Sự kiện | Mail gửi tới |
|---------|-------------|
| Tạo sự kiện mới (`POST /calendar/events`) | Tất cả thành phần tham dự |
| Duyệt sự kiện (`PATCH /calendar/events/:id/approve` status=approved) | Tất cả thành phần tham dự |
| Cập nhật sự kiện + có thay đổi participants | Danh sách participants mới |

> Mail gửi **bất đồng bộ** (fire-and-forget) — không làm chậm API response. Lỗi gửi mail chỉ ghi vào log, không trả về 500.

---

## 3. Cấu trúc EventParticipant

Khi tạo sự kiện, frontend gửi thêm field `structuredParticipants`:

```json
{
  "title": "Họp kế hoạch năm học",
  "eventDate": "2026-05-21",
  "structuredParticipants": [
    {
      "type": "user",
      "userId": "uuid-của-user",
      "displayName": "TS. Đỗ Đình Cường"
    },
    {
      "type": "department",
      "departmentId": "uuid-của-phòng",
      "displayName": "Phòng Đào Tạo"
    },
    {
      "type": "external",
      "email": "guest@example.com",
      "displayName": "Khách mời ngoài"
    }
  ]
}
```

### Logic resolve email:

- **type=user**: Lấy email từ bảng `users` theo `userId`
- **type=department**: Lấy toàn bộ email của `users` có `departmentId` đó và `isActive=true`
- **type=external**: Dùng trực tiếp field `email`
- Email trùng sẽ tự động bị loại bỏ (dedup)

---

## 4. API Departments (mới)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/v1/departments` | Danh sách đơn vị (grouped theo loại) |
| `GET` | `/api/v1/departments/with-members` | Đơn vị + danh sách thành viên (cho participant picker) |
| `GET` | `/api/v1/departments/:id/members` | Thành viên của một đơn vị cụ thể |

### Response mẫu `GET /departments/with-members`:

```json
[
  {
    "groupType": "PHONG_CHUC_NANG",
    "label": "Các Phòng Chức Năng",
    "departments": [
      {
        "id": "uuid",
        "name": "Phòng Đào Tạo",
        "code": "P.DT",
        "memberCount": 5,
        "members": [
          { "id": "uuid", "fullName": "TS. Nguyễn Văn A", "email": "nva@ictu.edu.vn" }
        ]
      }
    ]
  }
]
```

---

## 5. API Users — tìm kiếm cho participant picker

```
GET /api/v1/users/search?q=Cường&departmentId=uuid
```

Trả về danh sách users khớp tên, kèm thông tin phòng ban. Dùng để frontend hiển thị trong dropdown tìm kiếm.

---

## 6. Gán phòng ban cho user (Admin)

Sau khi deploy, admin cần vào **Quản lý Users** → sửa từng user → chọn phòng ban (`departmentId`).

Hoặc gọi API:
```
PATCH /api/v1/users/:id
Body: { "departmentId": "uuid-của-phòng" }
```

---

## 7. Departments được seed sẵn

Khi khởi động lần đầu, hệ thống tự tạo 24 đơn vị theo sơ đồ tổ chức ICTU:

| Nhóm | Đơn vị |
|------|--------|
| Ban Giám Hiệu | BGH |
| Phòng Chức Năng | P.HCTC, P.KHTC, P.DT, P.KHCN, P.CTNH |
| Khoa Chuyên Môn | K.KHCB, K.CNTT, K.KTQT, K.KTCN, K.NTTT |
| Trung Tâm | TT.TTTS, TT.THNN, TT.PTPM, TT.HTDN |
| Viện | V.DTQT, V.KHCNUD, V.TTNT, V.DMST |
| Đoàn Thể | CĐ, ĐTN, CCB, HSV, HCG |

---

## 8. Frontend — việc cần làm tiếp theo

- [ ] Tạo component `participant-selector` thay thế textarea `participants`
- [ ] Gọi `GET /departments/with-members` để render accordion chọn theo phòng
- [ ] Gọi `GET /users/search?q=...` cho ô tìm kiếm cá nhân
- [ ] Thêm form thêm khách ngoài (name + email)
- [ ] Gửi `structuredParticipants` trong payload tạo/sửa sự kiện
- [ ] Hiển thị participants dạng chip trong form và view chi tiết

---

## 9. Tắt/bật tính năng mail

Để **tắt** mail: xóa hoặc để trống `MAIL_USER` trong `.env` → NotificationService tự detect và skip.

Để **bật** lại: điền `MAIL_USER` + `MAIL_PASS` → restart server.
