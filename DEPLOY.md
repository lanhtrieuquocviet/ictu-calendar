# Hướng dẫn Deploy — ICTU Calendar

> Có **2 cách** deploy. Chọn cách phù hợp với server:
>
> | | Cách 1 — Docker Compose | Cách 2 — aaPanel thủ công |
> |---|---|---|
> | Độ khó | Dễ | Trung bình |
> | Yêu cầu | Docker trên server | aaPanel + Node.js + MySQL |
> | Khuyến nghị | **Ưu tiên dùng cách này** | Dùng khi server đã có aaPanel |

---

## Mục lục

- [Cách 1 — Docker Compose (Khuyến nghị)](#cách-1--docker-compose-khuyến-nghị)
- [Cách 2 — aaPanel thủ công](#cách-2--aapanel-thủ-công)
- [Cập nhật phiên bản mới](#cập-nhật-phiên-bản-mới)
- [Xử lý sự cố thường gặp](#xử-lý-sự-cố-thường-gặp)
- [Checklist triển khai lần đầu](#checklist-triển-khai-lần-đầu)

---

# Cách 1 — Docker Compose (Khuyến nghị)

Toàn bộ hệ thống (MySQL + Backend + Frontend) chạy trong Docker. **Không cần cài Node.js, MySQL thủ công trên server.**

## Yêu cầu máy chủ

| Tài nguyên | Tối thiểu |
|---|---|
| RAM | 2 GB |
| Disk | 10 GB trống |
| OS | Ubuntu 20.04+ / CentOS 7+ |
| Phần mềm | Docker 24+, Docker Compose v2 |

Kiểm tra Docker đã cài chưa:

```bash
docker --version
docker compose version
```

Nếu chưa có Docker, cài theo hướng dẫn chính thức: https://docs.docker.com/engine/install/ubuntu/

---

## Bước 1 — Lấy source code

```bash
cd /www/wwwroot
git clone <URL_REPO> ictu-calendar
cd ictu-calendar
```

---

## Bước 2 — Tạo file cấu hình

### File `.env` ở thư mục gốc

```bash
cp .env.example .env
nano .env
```

Điền 2 giá trị:

```env
DB_PASSWORD=<mật_khẩu_database_mạnh>
DB_NAME=ictu_calendar
```

### File `be/.env` — cấu hình backend

```bash
cp be/.env.example be/.env
nano be/.env
```

Điền đầy đủ theo bảng sau:

| Biến | Giá trị cần điền | Ghi chú |
|---|---|---|
| `NODE_ENV` | `production` | Giữ nguyên |
| `DB_HOST` | `mysql` | Giữ nguyên (tên container) |
| `DB_PASSWORD` | Phải **khớp** với `.env` gốc | |
| `ADMIN_EMAIL` | `admin@ictu.edu.vn` | Email đăng nhập admin |
| `ADMIN_PASSWORD` | Mật khẩu mạnh | Ví dụ: `Admin@Ictu2024!` |
| `JWT_SECRET` | Key ngẫu nhiên 64 byte | Xem hướng dẫn tạo bên dưới |
| `JWT_REFRESH_SECRET` | Key ngẫu nhiên **khác** | Xem hướng dẫn tạo bên dưới |
| `FRONTEND_URL` | `http://<IP_server>:4200` | Địa chỉ truy cập frontend |
| `MAIL_USER` | Gmail gửi thông báo | Để trống nếu chưa cần |
| `MAIL_PASS` | Gmail App Password | Để trống nếu chưa cần |

**Tạo JWT key ngẫu nhiên** (chạy 2 lần, lấy 2 giá trị khác nhau):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

> Nếu server chưa có Node.js: `docker run --rm node:20-alpine node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"`

---

## Bước 3 — Build và khởi động

```bash
cd /www/wwwroot/ictu-calendar
docker compose up -d --build
```

Lệnh này sẽ tự động:
1. Build image Backend và Frontend (~3–5 phút lần đầu)
2. Khởi động MySQL, chờ healthy
3. Khởi động Backend → tự chạy migration + tạo dữ liệu mặc định
4. Khởi động Frontend (Nginx)

Theo dõi quá trình:

```bash
docker compose logs -f
```

Chờ đến khi thấy:
```
ictu_calendar_be  | Application running on port 3000 [production]
```

---

## Bước 4 — Kiểm tra

```bash
# Xem trạng thái các container
docker compose ps

# Kiểm tra backend
curl http://localhost:3000/api/v1/health
# Kết quả mong đợi: {"status":"ok"}
```

Truy cập trình duyệt:
- **Frontend:** `http://<IP_server>:4200`
- **Đăng nhập admin:** dùng `ADMIN_EMAIL` / `ADMIN_PASSWORD` đã cấu hình

---

## Dữ liệu mặc định (tự tạo lần đầu khởi động)

| Dữ liệu | Chi tiết |
|---|---|
| Tài khoản admin | Theo `ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `be/.env` |
| 22 đơn vị | Ban Giám Hiệu, các Phòng/Khoa/Trung tâm/Viện của ICTU |
| Danh mục | Địa điểm, phương tiện, đơn vị truyền thông, người chủ trì |

> Nếu dữ liệu đã tồn tại (deploy lại), hệ thống **bỏ qua** — không bị trùng.

---

## Các lệnh quản lý Docker thường dùng

```bash
# Xem log realtime từng service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mysql

# Dừng hệ thống (giữ nguyên dữ liệu)
docker compose down

# Dừng và XÓA TOÀN BỘ dữ liệu DB (cẩn thận!)
docker compose down -v

# Khởi động lại một service
docker compose restart backend

# Vào shell trong container (debug)
docker compose exec backend sh
```

---

## Backup / Restore dữ liệu

```bash
# Backup
docker compose exec mysql mysqldump -uroot -p<DB_PASSWORD> ictu_calendar > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T mysql mysql -uroot -p<DB_PASSWORD> ictu_calendar < backup_20260610.sql
```

---

---

# Cách 2 — aaPanel thủ công

Dùng khi server đã chạy aaPanel và không muốn cài Docker.

## Yêu cầu

| Tài nguyên | Tối thiểu |
|---|---|
| RAM | 2 GB |
| OS | Ubuntu 20.04+ / CentOS 7+ |
| aaPanel | Đã cài, mở port 80, 443 |
| Phần mềm qua aaPanel | Nginx, MySQL 8, Node.js 20, PM2 |

Cài phần mềm qua **aaPanel → App Store**:

```bash
# Xác nhận sau khi cài
node -v    # v20.x.x
npm -v     # 10.x.x
pm2 -v     # 5.x.x
mysql -V   # 8.0.x
nginx -v   # 1.24.x
```

---

## Bước 1 — Tạo database MySQL

```bash
mysql -u root -p
```

```sql
CREATE DATABASE ictu_calendar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ictu_user'@'localhost' IDENTIFIED BY 'StrongPassword@2024!';
GRANT ALL PRIVILEGES ON ictu_calendar.* TO 'ictu_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## Bước 2 — Lấy source code

```bash
cd /www/wwwroot
git clone <URL_REPO> ictu-calendar
cd ictu-calendar
```

---

## Bước 3 — Cấu hình Backend

```bash
cd /www/wwwroot/ictu-calendar/be
cp .env.example .env
nano .env
```

Điền các giá trị:

```env
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=ictu_user
DB_PASSWORD=StrongPassword@2024!
DB_NAME=ictu_calendar

ADMIN_EMAIL=admin@ictu.edu.vn
ADMIN_PASSWORD=Admin@Ictu2024!
ADMIN_FULLNAME=Administrator

JWT_SECRET=<64-byte-random-base64>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<64-byte-random-base64-khác>
JWT_REFRESH_EXPIRES_IN=30d

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_gmail_app_password

FRONTEND_URL=https://calendar.ictu.edu.vn
UPLOAD_DIR=/www/wwwroot/ictu-calendar/uploads

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://calendar.ictu.edu.vn/api/v1/auth/google/callback
GOOGLE_CALENDAR_CALLBACK_URL=https://calendar.ictu.edu.vn/api/v1/auth/google/calendar/callback
```

```bash
# Tạo thư mục uploads
mkdir -p /www/wwwroot/ictu-calendar/uploads
chown -R www:www /www/wwwroot/ictu-calendar/uploads

# Cài dependencies và build
npm ci --omit=dev
npm run build

# Khởi động bằng PM2
pm2 start dist/main.js --name "ictu-calendar-be" --max-memory-restart 512M
pm2 save
pm2 startup
# Chạy lệnh mà PM2 in ra (dạng: sudo env PATH=...)
```

---

## Bước 4 — Build Frontend

```bash
cd /www/wwwroot/ictu-calendar/fe
npm ci
npm run build:prod
```

Output tại: `fe/dist/ictu-calendar-fe/browser/`

---

## Bước 5 — Cấu hình Nginx

Vào **aaPanel → Website → Add Site** → tạo site với domain của bạn.

Vào **Settings → Config**, thay toàn bộ bằng:

```nginx
server {
    listen 80;
    server_name calendar.ictu.edu.vn;

    charset utf-8;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # API — proxy tới NestJS
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
        proxy_read_timeout 120s;
    }

    # Frontend Angular
    location / {
        root /www/wwwroot/ictu-calendar/fe/dist/ictu-calendar-fe/browser;
        index index.html;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

```bash
nginx -t        # kiểm tra syntax
nginx -s reload # áp dụng config
```

---

## Bước 6 — SSL (HTTPS)

Vào **aaPanel → Website → [tên site] → SSL → Let's Encrypt**:
1. Chọn domain → **Apply**
2. Bật **Force HTTPS**

---

## Bước 7 — Cấu hình Google OAuth (nếu dùng)

Vào [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), thêm vào **Authorized redirect URIs**:

```
https://calendar.ictu.edu.vn/api/v1/auth/google/callback
https://calendar.ictu.edu.vn/api/v1/auth/google/calendar/callback
```

Cập nhật `be/.env` rồi restart:

```bash
pm2 restart ictu-calendar-be
```

---

---

# Cập nhật phiên bản mới

### Cách 1 — Docker Compose

```bash
cd /www/wwwroot/ictu-calendar
git pull origin main
docker compose up -d --build
```

Migration mới (nếu có) tự chạy khi backend khởi động lại.

### Cách 2 — aaPanel

```bash
cd /www/wwwroot/ictu-calendar
git pull origin main

# Backend
cd be
npm ci --omit=dev && npm run build
pm2 reload ictu-calendar-be

# Frontend (nếu có thay đổi)
cd ../fe
npm ci && npm run build:prod
```

---

# Xử lý sự cố thường gặp

### Backend không khởi động

```bash
# Docker
docker compose logs backend --tail 50

# aaPanel
pm2 logs ictu-calendar-be --err --lines 50
```

Kiểm tra: file `.env` đúng chưa, DB đang chạy chưa, port 3000 bị chiếm chưa.

### Lỗi CORS (frontend không gọi được API)

`FRONTEND_URL` trong `be/.env` phải khớp **chính xác** với địa chỉ truy cập thực tế (gồm cả `http://` hoặc `https://`).

### Angular route trả về 404

Nginx thiếu `try_files $uri $uri/ /index.html;`. Kiểm tra lại config.

### File upload không được

```bash
# aaPanel
mkdir -p /www/wwwroot/ictu-calendar/uploads
chown -R www:www /www/wwwroot/ictu-calendar/uploads

# Docker — volume đã tự xử lý, kiểm tra docker-compose.yml có dòng:
# volumes:
#   - uploads_data:/app/uploads
```

### Hết RAM — backend bị kill

```bash
# Thêm swap 2GB (Linux)
fallocate -l 2G /swapfile
chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

# Checklist triển khai lần đầu

### Docker Compose

- [ ] Docker và Docker Compose đã cài trên server
- [ ] File `.env` ở thư mục gốc đã điền `DB_PASSWORD`
- [ ] File `be/.env` đã điền đầy đủ, JWT secret là giá trị ngẫu nhiên
- [ ] `FRONTEND_URL` trong `be/.env` trỏ đúng địa chỉ server
- [ ] `docker compose up -d --build` chạy thành công
- [ ] `curl http://localhost:3000/api/v1/health` trả về `{"status":"ok"}`
- [ ] Đăng nhập thành công trên trình duyệt

### aaPanel

- [ ] aaPanel đã cài: Nginx, MySQL 8, Node.js 20, PM2
- [ ] Database `ictu_calendar` đã tạo với user riêng (không dùng `root`)
- [ ] Thư mục `uploads/` đã tạo và có quyền ghi
- [ ] File `be/.env` đã điền đầy đủ, JWT secret là giá trị ngẫu nhiên
- [ ] Backend đã `npm ci --omit=dev` + `npm run build` + `pm2 start` + `pm2 save`
- [ ] Frontend đã `npm run build:prod`, Nginx trỏ đúng thư mục `dist/`
- [ ] Nginx `try_files` đã cấu hình (Angular routing)
- [ ] SSL đã cài, Force HTTPS bật
- [ ] Google OAuth redirect URI đã cập nhật (nếu dùng)
- [ ] `curl https://<domain>/api/v1/health` trả về `{"status":"ok"}`
- [ ] Đăng nhập thành công trên trình duyệt
