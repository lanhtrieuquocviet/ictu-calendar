# ICTU Calendar

Hệ thống quản lý lịch sự kiện trường ICTU.

- **Backend**: NestJS + TypeORM + MySQL
- **Frontend**: Angular 17

---

## Yêu cầu môi trường

| Công cụ | Phiên bản |
|---------|-----------|
| Node.js | >= 20 |
| npm | >= 9 |
| MySQL | 8.0 |
| Docker + Docker Compose | Bắt buộc để chạy MinIO |

---

## Chạy thủ công (không dùng Docker)

### 1. Cấu hình môi trường backend

```bash
cd be
cp .env.example .env
```

Mở file `be/.env` và điền đúng các giá trị:
- `DB_PASSWORD` — mật khẩu MySQL
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — sinh ngẫu nhiên bằng lệnh:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
  ```
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — tài khoản admin đầu tiên
- `MAIL_USER` / `MAIL_PASS` — Gmail App Password (bỏ trống nếu không dùng email)
- `MINIO_ENDPOINT=localhost` — **đổi thành `localhost`** khi chạy local (mặc định trong `.env.example` là `minio` dùng cho Docker)
- `MINIO_SECRET_KEY` — mật khẩu MinIO tự đặt

### 2. Khởi động MinIO (bắt buộc để upload file đính kèm)

```bash
docker run -d --name ictu_minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=your_minio_secret \
  minio/minio server /data --console-address ":9001"
```

> MinIO Console (giao diện quản lý file): http://localhost:9001

### 2. Tạo database rỗng trong MySQL

```sql
CREATE DATABASE ictu_calendar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> **Không cần import file `.sql` nào.** Khi backend khởi động lần đầu:
> - TypeORM tự động tạo toàn bộ bảng
> - Seeder tự điền danh mục, phòng ban và tài khoản admin

### 3. Chạy backend

```bash
cd be
npm install
npm run start:dev       # development (có hot reload)
npm run build && npm run start:prod   # production
```

Quan sát console — khi thấy các dòng sau là thành công:

```
[SeederService] ✅ Admin seeded — email: admin@ictu.edu.vn
[SeederService] ✅ Seeded 22 departments
[SeederService] ✅ Seeded 18 categories
Application running on port 3000 [development]
```

> Lần chạy thứ 2 trở đi sẽ thấy `already seeded, skipping` — bình thường, không phải lỗi.

Đăng nhập bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD` đã điền trong `.env`.

### 3. Cấu hình frontend

Mở [fe/src/environments/environment.prod.ts](fe/src/environments/environment.prod.ts) và đổi `apiUrl` thành địa chỉ backend thực tế:

```ts
apiUrl: 'http://<IP_SERVER>:3000/api/v1'
```

### 4. Chạy frontend

```bash
cd fe
npm install
npm start               # development: http://localhost:4200
npm run build:prod      # build production vào fe/dist/
```

---

## Deploy bằng Docker Compose

### 1. Chuẩn bị file `.env`

```bash
# File cấu hình cho docker-compose (database + MinIO)
cp .env.example .env

# File cấu hình cho backend
cp be/.env.example be/.env
```

Chỉnh sửa `.env` (thư mục gốc):
```
DB_PASSWORD=<mật_khẩu_mạnh>
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=<mật_khẩu_minio_mạnh>
```

Chỉnh sửa `be/.env`:
```
NODE_ENV=production
DB_PASSWORD=<giống DB_PASSWORD ở .env>
JWT_SECRET=<64_byte_random_base64>
JWT_REFRESH_SECRET=<64_byte_random_base64>
ADMIN_PASSWORD=<mật_khẩu_admin>
FRONTEND_URL=http://<IP_SERVER>:4200
MAIL_USER=your@gmail.com
MAIL_PASS=xxxx xxxx xxxx xxxx
MINIO_SECRET_KEY=<giống MINIO_SECRET_KEY ở .env>
# Giữ nguyên MINIO_ENDPOINT=minio khi dùng Docker Compose
```

### 2. Cấu hình URL API cho frontend

Sửa [fe/src/environments/environment.prod.ts](fe/src/environments/environment.prod.ts):
```ts
apiUrl: 'http://<IP_SERVER>:3000/api/v1'
```

### 3. Build và chạy

```bash
# Từ thư mục gốc dự án
docker compose up --build -d
```

| Dịch vụ | Địa chỉ |
|---------|---------|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:3000/api/v1 |
| Swagger Docs | http://localhost:3000/api/docs |
| MinIO Console | http://localhost:9001 |
| MySQL | localhost:3306 |

### 4. Xem log

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

### 5. Dừng

```bash
docker compose down          # giữ dữ liệu DB
docker compose down -v       # xóa cả dữ liệu DB
```

---

## Cấu trúc dự án

```
ictu-calendar/
├── be/                     # NestJS backend
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/       # Đăng nhập, JWT, refresh token
│   │   │   ├── users/      # Quản lý người dùng
│   │   │   ├── calendar/   # Sự kiện, file đính kèm
│   │   │   └── notification/ # Gửi email thông báo
│   │   └── database/
│   │       └── seeder/     # Tạo dữ liệu mẫu khi khởi động
│   ├── .env.example        # Mẫu cấu hình môi trường
│   └── Dockerfile
├── fe/                     # Angular 17 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── features/calendar/
│   │   │   └── core/services/
│   │   └── environments/
│   ├── nginx.conf
│   └── Dockerfile
├── .env.example            # Biến môi trường cho docker-compose
└── docker-compose.yml
```

---

## Tài khoản mặc định

Khi backend khởi động lần đầu, hệ thống tự tạo tài khoản admin từ biến môi trường:

| Trường | Giá trị từ `.env` |
|--------|-------------------|
| Email | `ADMIN_EMAIL` |
| Mật khẩu | `ADMIN_PASSWORD` |
| Vai trò | `admin` |

**Đổi mật khẩu admin ngay sau khi đăng nhập lần đầu.**

---

## Phân quyền

| Role | Quyền |
|------|-------|
| `admin` | Toàn quyền: duyệt/từ chối sự kiện, quản lý người dùng |
| `editor` | Tạo, sửa, xóa sự kiện của bản thân |
| `viewer` | Xem lịch |
