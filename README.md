# ICTU Calendar

Hệ thống quản lý lịch công tác nội bộ — Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU).

**Công nghệ:** Angular 17 · NestJS · MySQL 8

---

## Yêu cầu

| Công cụ | Ghi chú |
|---|---|
| Node.js >= 20 | Backend + Frontend |
| Docker Desktop | Chạy MySQL |

---

## Cài đặt và chạy (môi trường phát triển)

### Bước 1 — Khởi động MySQL bằng Docker

```bash
docker run -d --name ictu_calendar_db \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=your_db_password \
  -e MYSQL_DATABASE=ictu_calendar \
  mysql:8.0
```

> Lệnh này chỉ cần chạy **một lần**. Những lần sau Docker Desktop tự khởi động lại cùng máy.

### Bước 2 — Cấu hình backend

```bash
cd be
cp .env.example .env
```

Mở `be/.env` và điền các giá trị bắt buộc:

```env
DB_PASSWORD=your_db_password          # giống MYSQL_ROOT_PASSWORD ở bước 1
JWT_SECRET=<chuỗi ngẫu nhiên 64 byte>
JWT_REFRESH_SECRET=<chuỗi ngẫu nhiên 64 byte khác>
```

Sinh JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Bước 3 — Chạy backend

```bash
cd be
npm install
npm run start:dev
```

Khi thấy các dòng sau là thành công:

```
[SeederService] ✅ Admin seeded
[SeederService] ✅ Seeded 22 departments
Application running on port 3000
```

### Bước 4 — Chạy frontend

```bash
cd fe
npm install
npm start
```

### Kết quả

| Dịch vụ | Địa chỉ |
|---|---|
| Ứng dụng | http://localhost:4200 |
| API | http://localhost:3000/api/v1 |
| Swagger Docs | http://localhost:3000/api/docs |

---

## Tài khoản mặc định

Hệ thống tự tạo tài khoản admin từ `be/.env` khi backend khởi động lần đầu:

| Trường | Giá trị mặc định |
|---|---|
| Email | `admin@ictu.edu.vn` |
| Mật khẩu | `Admin@ChangeMeNow123!` |

**Đổi mật khẩu ngay sau lần đăng nhập đầu tiên.**

---

## Deploy (production)

Dùng Docker Compose để chạy toàn bộ stack trên server:

```bash
cp .env.example .env          # điền DB_PASSWORD
cp be/.env.example be/.env    # điền JWT_SECRET và các biến còn lại
```

Sửa `be/.env` cho production:
```env
NODE_ENV=production
DB_HOST=mysql                 # tên service trong docker-compose, không phải localhost
UPLOAD_DIR=/app/uploads       # đã được đặt sẵn đúng
FRONTEND_URL=http://<IP_SERVER>:4200
```

Sửa địa chỉ API trong `fe/src/environments/environment.prod.ts`:
```ts
apiUrl: 'http://<IP_SERVER>:3000/api/v1'
```

Sau đó chạy:
```bash
docker-compose up --build -d
```

File đính kèm được lưu trong Docker volume `uploads_data`, persist qua restart.

---

## Phân quyền

| Role | Quyền |
|---|---|
| `admin` | Toàn quyền — duyệt sự kiện, quản lý người dùng |
| `approver` | Duyệt / từ chối / hủy sự kiện |
| `editor` | Tạo, sửa, xóa sự kiện của bản thân |
| `viewer` | Chỉ xem lịch |

---

## Cấu trúc dự án

```
ictu-calendar/
├── be/                  # NestJS — API, business logic, gửi mail
│   ├── src/modules/
│   │   ├── auth/        # Đăng nhập, JWT refresh token
│   │   ├── calendar/    # Sự kiện, file đính kèm
│   │   ├── users/       # Quản lý người dùng
│   │   ├── storage/     # Local filesystem storage
│   │   └── notification/# Gửi email thông báo
│   └── .env.example
├── fe/                  # Angular 17 — giao diện người dùng
├── docker-compose.yml   # Deploy production
└── .env.example         # Biến môi trường cho docker-compose
```

---

## Lệnh hay dùng

```bash
# Xem log backend realtime
docker logs -f ictu_calendar_be

# Chạy test
cd be && npm test

# Dừng MySQL khi không dùng
docker stop ictu_calendar_db

# Khởi lại MySQL
docker start ictu_calendar_db
```
