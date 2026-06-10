# Hướng dẫn Deploy ICTU Calendar lên aaPanel

> Stack: **NestJS** (backend) · **Angular** (frontend) · **MySQL 8** · **Nginx** · **PM2**

---

## Mục lục

1. [Yêu cầu server](#1-yêu-cầu-server)
2. [Cài đặt aaPanel & phần mềm cần thiết](#2-cài-đặt-aapanel--phần-mềm-cần-thiết)
3. [Cấu hình MySQL](#3-cấu-hình-mysql)
4. [Upload source code](#4-upload-source-code)
5. [Cấu hình Backend (NestJS)](#5-cấu-hình-backend-nestjs)
6. [Cấu hình Frontend (Angular)](#6-cấu-hình-frontend-angular)
7. [Cấu hình Nginx Reverse Proxy](#7-cấu-hình-nginx-reverse-proxy)
8. [SSL (HTTPS) với Let's Encrypt](#8-ssl-https-với-lets-encrypt)
9. [Cấu hình Google OAuth2 (nếu dùng)](#9-cấu-hình-google-oauth2-nếu-dùng)
10. [Kiểm tra & Health Check](#10-kiểm-tra--health-check)
11. [Cập nhật phiên bản mới](#11-cập-nhật-phiên-bản-mới)
12. [Xử lý sự cố thường gặp](#12-xử-lý-sự-cố-thường-gặp)
13. [Tóm tắt các bước deploy](#tóm-tắt-các-bước-deploy)

---

## 1. Yêu cầu server

| Tài nguyên | Tối thiểu | Khuyến nghị |
|------------|-----------|-------------|
| CPU | 1 vCore | 2 vCore |
| RAM | 1 GB | 2 GB |
| Disk | 20 GB | 40 GB SSD |
| OS | Ubuntu 20.04+ / CentOS 7+ | Ubuntu 22.04 LTS |

**Mở firewall các port sau:**

| Port | Mục đích |
|------|----------|
| 22 | SSH |
| 80 | HTTP |
| 443 | HTTPS |
| 8888 | aaPanel web UI |

---

## 2. Cài đặt aaPanel & phần mềm cần thiết

### 2.1 Cài aaPanel (chạy với root)

```bash
# Ubuntu / Debian
wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh && bash install.sh aapanel

# CentOS
yum install -y wget && wget -O install.sh http://www.aapanel.com/script/install_6.0_en.sh && bash install.sh aapanel
```

Lưu lại **URL aaPanel**, **username**, **password** hiện ra sau khi cài.

### 2.2 Cài phần mềm qua aaPanel

Vào **aaPanel → App Store**, cài các gói sau:

| Phần mềm | Phiên bản |
|----------|-----------|
| Nginx | 1.24+ |
| MySQL | 8.0 |
| Node.js | 20.x (LTS) |
| PM2 (qua Node Manager) | latest |

> **Lưu ý:** Cài Node.js qua **aaPanel → App Store → Node.js Version Manager**, chọn Node 20.x và đặt làm default.

Xác nhận sau khi cài:

```bash
node -v     # v20.x.x
npm -v      # 10.x.x
pm2 -v      # 5.x.x
mysql -V    # 8.0.x
nginx -v    # 1.24.x
```

---

## 3. Cấu hình MySQL

### 3.1 Tạo database và user

Vào **aaPanel → Database → Add Database** hoặc dùng lệnh:

```sql
-- Đăng nhập MySQL
mysql -u root -p

-- Tạo database
CREATE DATABASE ictu_calendar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tạo user riêng (KHÔNG dùng root cho app)
CREATE USER 'ictu_user'@'localhost' IDENTIFIED BY 'StrongPassword@2024!';
GRANT ALL PRIVILEGES ON ictu_calendar.* TO 'ictu_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3.2 Kiểm tra kết nối

```bash
mysql -u ictu_user -p ictu_calendar
```

---

## 4. Upload source code

### Cách 1: Clone từ Git (khuyến nghị)

```bash
cd /www/wwwroot
git clone <your-git-repo-url> ictu-calendar
cd ictu-calendar
```

### Cách 2: Upload qua aaPanel File Manager

Nén project thành `.zip` (loại bỏ `node_modules`), upload qua **aaPanel → File → Upload**, giải nén vào `/www/wwwroot/ictu-calendar/`.

### Cấu trúc thư mục sau upload

```
/www/wwwroot/ictu-calendar/
├── be/          ← NestJS backend
└── fe/          ← Angular frontend
```

---

## 6. Cấu hình Backend (NestJS)

### 6.1 Tạo file .env cho production

```bash
cd /www/wwwroot/ictu-calendar/be
cp .env.example .env
nano .env
```

Điền đầy đủ các giá trị thực:

```env
# App
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1

# Database (MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=ictu_user
DB_PASSWORD=StrongPassword@2024!
DB_NAME=ictu_calendar

# Admin seed (tạo lần đầu)
ADMIN_EMAIL=admin@ictu.edu.vn
ADMIN_PASSWORD=Admin@ChangeMeNow123!
ADMIN_FULLNAME=Administrator

# JWT — tạo key ngẫu nhiên:
# node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
JWT_SECRET=<64-byte-random-base64>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<64-byte-random-base64-khác>
JWT_REFRESH_EXPIRES_IN=1d

# Mail (Gmail SMTP)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_gmail_app_password

# URL frontend — thay bằng domain thật
FRONTEND_URL=https://calendar.ictu.edu.vn

# Local Storage (file đính kèm)
UPLOAD_DIR=/www/wwwroot/ictu-calendar/uploads

# Mật khẩu mặc định khi import user từ Excel
IMPORT_DEFAULT_PASSWORD=Ictu@ChangeMe2024!

# Google OAuth2
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_CALLBACK_URL=https://calendar.ictu.edu.vn/api/v1/auth/google/callback
GOOGLE_CALENDAR_CALLBACK_URL=https://calendar.ictu.edu.vn/api/v1/auth/google/calendar/callback
```

> **Tạo JWT secret:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
> ```
> Chạy 2 lần, dùng 2 giá trị khác nhau cho `JWT_SECRET` và `JWT_REFRESH_SECRET`.

### 6.2 Cài dependencies và build

```bash
cd /www/wwwroot/ictu-calendar/be

# Cài packages
npm ci --omit=dev

# Build TypeScript → JavaScript
npm run build
```

> `npm ci` nhanh hơn `npm install` và đảm bảo khớp `package-lock.json`.
> `--omit=dev` bỏ qua devDependencies, tiết kiệm bộ nhớ.

### 6.3 Chạy migration database

```bash
# Migration chạy tự động khi NODE_ENV=production (migrationsRun: true)
# Nhưng có thể chạy thủ công để kiểm tra:
node dist/main
# Ctrl+C sau khi thấy "Application running on port 3000"
```

### 6.4 Khởi động bằng PM2

```bash
# Khởi động app
pm2 start dist/main.js --name "ictu-calendar-be" --max-memory-restart 512M

# Tự khởi động lại khi reboot server
pm2 save
pm2 startup systemd
# Chạy lệnh mà PM2 in ra (dạng: sudo env PATH=...)

# Xem log
pm2 logs ictu-calendar-be

# Xem trạng thái
pm2 status
```

---

## 7. Cấu hình Frontend (Angular)

### 7.1 Sửa environment.prod.ts

```bash
nano /www/wwwroot/ictu-calendar/fe/src/environments/environment.prod.ts
```

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://calendar.ictu.edu.vn/api/v1',
};
```

> Thay `calendar.ictu.edu.vn` bằng domain thật của bạn.

### 7.2 Cài dependencies và build

```bash
cd /www/wwwroot/ictu-calendar/fe

# Cài packages
npm ci

# Build production
npm run build:prod
```

Output nằm ở: `/www/wwwroot/ictu-calendar/fe/dist/ictu-calendar-fe/browser/`

---

## 8. Cấu hình Nginx Reverse Proxy

Vào **aaPanel → Website → Add Site**, tạo site mới với domain của bạn (ví dụ: `calendar.ictu.edu.vn`).

Sau khi tạo, vào **Settings → Config** của site, thay toàn bộ nội dung bằng config dưới đây:

```nginx
server {
    listen 80;
    server_name calendar.ictu.edu.vn;

    # Charset
    charset utf-8;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/xml+rss text/javascript
               image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # ===================== API — proxy tới NestJS =====================
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Upload file lớn
        client_max_body_size 50M;

        # Timeout cho long-running requests
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # ===================== Frontend Angular =====================
    location / {
        # Trỏ tới thư mục build của Angular
        root /www/wwwroot/ictu-calendar/fe/dist/ictu-calendar-fe/browser;
        index index.html;

        # Angular Router — trả về index.html cho mọi route
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

> **Quan trọng:** Kiểm tra lại đường dẫn `root` — xem thư mục build Angular ở bước 7.3.
> Nếu tên khác (ví dụ `dist/ictu-calendar/browser`), sửa lại cho đúng.

### Kiểm tra và reload Nginx

```bash
nginx -t          # kiểm tra syntax
nginx -s reload   # áp dụng config mới
```

---

## 9. SSL (HTTPS) với Let's Encrypt

Vào **aaPanel → Website → [tên site] → SSL → Let's Encrypt**:

1. Chọn domain
2. Nhấn **Apply** — aaPanel tự xin chứng chỉ và cấu hình Nginx

Sau khi có SSL, bật **Force HTTPS** trong cùng trang SSL.

Nginx sẽ tự động thêm redirect 80 → 443. Config HTTPS hoàn chỉnh sẽ tương tự:

```nginx
server {
    listen 443 ssl http2;
    server_name calendar.ictu.edu.vn;

    ssl_certificate     /www/server/panel/vhost/cert/calendar.ictu.edu.vn/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/calendar.ictu.edu.vn/privkey.pem;

    # ... phần còn lại giống config HTTP ở trên
}

server {
    listen 80;
    server_name calendar.ictu.edu.vn;
    return 301 https://$server_name$request_uri;
}
```

---

## 10. Cấu hình Google OAuth2 (nếu dùng)

### 10.1 Cập nhật Google Cloud Console

Vào [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):

1. Mở OAuth 2.0 Client ID của dự án
2. **Authorized JavaScript origins** — thêm:
   ```
   https://calendar.ictu.edu.vn
   ```
3. **Authorized redirect URIs** — thêm **cả hai**:
   ```
   https://calendar.ictu.edu.vn/api/v1/auth/google/callback
   https://calendar.ictu.edu.vn/api/v1/auth/google/calendar/callback
   ```

### 10.2 Cập nhật .env backend

```env
GOOGLE_CALLBACK_URL=https://calendar.ictu.edu.vn/api/v1/auth/google/callback
GOOGLE_CALENDAR_CALLBACK_URL=https://calendar.ictu.edu.vn/api/v1/auth/google/calendar/callback
FRONTEND_URL=https://calendar.ictu.edu.vn
```

Restart backend sau khi thay đổi `.env`:

```bash
pm2 restart ictu-calendar-be
```

---

## 11. Kiểm tra & Health Check

```bash
# 1. Backend health
curl https://calendar.ictu.edu.vn/api/v1/health
# Mong đợi: {"status":"ok"}

# 2. PM2 status
pm2 status

# 3. PM2 logs (30 dòng gần nhất)
pm2 logs ictu-calendar-be --lines 30

# 4. MySQL connection
mysql -u ictu_user -p ictu_calendar -e "SHOW TABLES;"

# 5. Nginx status
systemctl status nginx

# 6. Port đang lắng nghe
ss -tlnp | grep -E '80|443|3000'
```

---

## 12. Cập nhật phiên bản mới

```bash
cd /www/wwwroot/ictu-calendar

# 1. Pull code mới
git pull origin main

# 2. Build lại backend
cd be
npm ci --omit=dev
npm run build

# 3. Restart backend (zero-downtime nếu dùng pm2 reload thay vì restart)
pm2 reload ictu-calendar-be

# 4. Build lại frontend (nếu có thay đổi FE)
cd ../fe
npm ci
npm run build:prod

# 5. Nginx không cần restart (file tĩnh được đọc ngay)
```

---

## 13. Xử lý sự cố thường gặp

### Backend không khởi động

```bash
pm2 logs ictu-calendar-be --err --lines 50
```

Kiểm tra:
- File `.env` tồn tại và đúng giá trị
- MySQL đang chạy: `systemctl status mysql`
- Port 3000 chưa bị chiếm: `ss -tlnp | grep 3000`

### Nginx 502 Bad Gateway

Backend chưa chạy hoặc sai port. Kiểm tra:

```bash
pm2 status
# Nếu stopped → pm2 start ictu-calendar-be
```

### Lỗi CORS

Đảm bảo `FRONTEND_URL` trong `.env` backend khớp chính xác với domain frontend (bao gồm `https://`).

### Angular route trả về 404

Nginx thiếu `try_files $uri $uri/ /index.html;` trong location `/`. Kiểm tra lại config Nginx.

### File đính kèm không upload được

Kiểm tra thư mục uploads tồn tại và có quyền ghi:

```bash
ls -la /www/wwwroot/ictu-calendar/uploads
# Nếu chưa có: mkdir -p /www/wwwroot/ictu-calendar/uploads
chown -R www:www /www/wwwroot/ictu-calendar/uploads
```

Kiểm tra biến `UPLOAD_DIR` trong `.env` trỏ đúng đường dẫn.

### Migration lỗi khi deploy

```bash
# Xem log migration
pm2 logs ictu-calendar-be --lines 100 | grep -i migration

# Nếu cần revert migration gần nhất
cd /www/wwwroot/ictu-calendar/be
NODE_ENV=production node -e "
const {DataSource} = require('typeorm');
// chạy migration:revert thủ công nếu cần
"
```

### Cạn RAM — NestJS bị OOM

```bash
# Tăng giới hạn memory cho PM2
pm2 start dist/main.js --name ictu-calendar-be --max-memory-restart 768M

# Hoặc thêm swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## Checklist triển khai lần đầu

- [ ] Server đủ tài nguyên, firewall đã mở đúng port
- [ ] aaPanel đã cài: Nginx, MySQL 8, Node.js 20, PM2
- [ ] Database `ictu_calendar` đã tạo, user không phải `root`
- [ ] Thư mục `uploads/` đã tạo, có quyền ghi
- [ ] File `.env` đã điền đầy đủ, JWT secret là random
- [ ] Backend đã `npm ci --omit=dev` + `npm run build`
- [ ] Backend chạy qua PM2, `pm2 save` đã gọi
- [ ] `environment.prod.ts` trỏ đúng domain, frontend đã `npm run build:prod`
- [ ] Nginx config đúng đường dẫn `root` và `try_files`
- [ ] SSL đã cài, Force HTTPS bật
- [ ] Google OAuth callback URL đã cập nhật (nếu dùng)
- [ ] Health check `/api/v1/health` trả về `{"status":"ok"}`
- [ ] Đăng nhập thành công trên domain thật

---

## Tóm tắt các bước deploy

```
1. SERVER      Mở port 80, 443, 8888 · RAM ≥ 2GB
               aaPanel → cài Nginx + MySQL 8 + Node.js 20 + PM2

2. DATABASE    Tạo DB ictu_calendar + user riêng (không dùng root)

3. CODE        git clone về /www/wwwroot/ictu-calendar/

4. BACKEND     cp .env.example .env  →  điền đầy đủ  →  sinh JWT secret ngẫu nhiên
               npm ci --omit=dev  →  npm run build
               pm2 start dist/main.js  →  pm2 save

5. FRONTEND    Sửa environment.prod.ts → đúng domain
               npm ci  →  npm run build:prod
               Output: fe/dist/ictu-calendar-fe/browser/

6. NGINX       Tạo site trong aaPanel
               /api/  →  proxy_pass http://127.0.0.1:3000
               /      →  root trỏ tới thư mục build Angular

7. SSL         aaPanel → Website → SSL → Let's Encrypt → Apply → Force HTTPS

8. GOOGLE      Thêm 2 redirect URI vào Google Console (login + calendar)
               Cập nhật GOOGLE_CALLBACK_URL và GOOGLE_CALENDAR_CALLBACK_URL trong .env
               pm2 restart ictu-calendar-be

9. VERIFY      curl https://<domain>/api/v1/health  →  {"status":"ok"}
               Đăng nhập thành công trên trình duyệt
```
