# Hướng dẫn nhận và chạy dự án ICTU Calendar

Tài liệu này dành cho người nhận bàn giao dự án lần đầu.  
Đọc từ trên xuống, làm theo từng bước.

---

## Bước 1 — Cài phần mềm cần thiết

Cài 2 thứ sau nếu máy chưa có:

### Node.js
- Tải tại: https://nodejs.org → chọn bản **LTS** → cài như phần mềm bình thường
- Kiểm tra cài thành công: mở **Command Prompt** gõ `node -v` → thấy số phiên bản là được

### MySQL 8.0
- Tải tại: https://dev.mysql.com/downloads/installer/
- Trong quá trình cài, nhớ đặt **mật khẩu root** và ghi lại

---

## Bước 2 — Nhận source code

Nếu nhận qua **file .zip**:
1. Giải nén ra thư mục bất kỳ (ví dụ `C:\ictu-calendar`)
2. Chuyển sang Bước 3

Nếu nhận qua **Git**:
```
git clone <link-repository>
```

---

## Bước 3 — Tạo file cấu hình `.env`

1. Vào thư mục `be/`
2. Copy file `.env.example` → đặt tên là `.env` (chú ý: không có chữ "example")
3. Mở file `.env` bằng Notepad, sửa các dòng sau:

```
DB_PASSWORD=<mật khẩu MySQL root của máy bạn>

JWT_SECRET=<chuỗi bí mật bất kỳ, dài ít nhất 32 ký tự>
JWT_REFRESH_SECRET=<chuỗi bí mật khác, dài ít nhất 32 ký tự>

ADMIN_EMAIL=<email đăng nhập tài khoản admin>
ADMIN_PASSWORD=<mật khẩu admin, ít nhất 8 ký tự, có chữ hoa + số>
```

> Các dòng khác giữ nguyên mặc định nếu không có yêu cầu thay đổi.

---

## Bước 4 — Tạo database

1. Mở **MySQL Workbench** (hoặc bất kỳ công cụ MySQL nào)
2. Kết nối vào MySQL
3. Chạy lệnh sau:

```sql
CREATE DATABASE ictu_calendar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> Chỉ cần tạo database rỗng. **Không cần import file `.sql` nào cả** —
> hệ thống tự tạo bảng và điền dữ liệu ban đầu khi chạy lần đầu.

---

## Bước 5 — Chạy Backend

Mở **Command Prompt** hoặc **Terminal**, chạy lần lượt:

```bash
cd be
npm install
npm run start:dev
```

Chờ đến khi thấy các dòng này xuất hiện:

```
[SeederService] ✅ Admin seeded — email: ...
[SeederService] ✅ Seeded 22 departments
[SeederService] ✅ Seeded 18 categories
Application running on port 3000 [development]
```

Vậy là backend đã chạy thành công tại `http://localhost:3000`.

> **Lần chạy thứ 2 trở đi** sẽ thấy `already seeded, skipping` — bình thường, không phải lỗi.

---

## Bước 6 — Chạy Frontend

Mở **Command Prompt mới** (giữ nguyên cửa sổ backend), chạy:

```bash
cd fe
npm install
npm start
```

Chờ đến khi thấy:

```
** Angular Live Development Server is listening on localhost:4200 **
```

Mở trình duyệt vào `http://localhost:4200` là dùng được.

---

## Bước 7 — Đăng nhập lần đầu

Dùng thông tin đã điền ở Bước 3:

| Trường | Giá trị |
|--------|---------|
| Email | Giá trị `ADMIN_EMAIL` trong `.env` |
| Mật khẩu | Giá trị `ADMIN_PASSWORD` trong `.env` |

Tài khoản này có quyền **admin** — có thể duyệt sự kiện, quản lý người dùng.

---

## Phân quyền trong hệ thống

| Vai trò | Quyền |
|---------|-------|
| **admin** | Duyệt / từ chối sự kiện, quản lý toàn bộ người dùng |
| **editor** | Tạo, sửa, xóa sự kiện của bản thân |
| **viewer** | Chỉ xem lịch |

---

## Xử lý lỗi thường gặp

**Lỗi: `Access denied for user 'root'@'localhost'`**
→ Sai mật khẩu DB. Kiểm tra lại `DB_PASSWORD` trong `be/.env`.

**Lỗi: `Unknown database 'ictu_calendar'`**
→ Chưa tạo database. Quay lại Bước 4.

**Lỗi: `EADDRINUSE: address already in use :::3000`**
→ Cổng 3000 đang bị chiếm. Tắt ứng dụng khác đang dùng cổng này, hoặc đổi `PORT` trong `.env`.

**Trang web trắng / không tải được dữ liệu**
→ Backend chưa chạy hoặc chạy lỗi. Kiểm tra cửa sổ terminal backend còn mở không.

**`npm install` báo lỗi**
→ Thử xóa thư mục `node_modules` rồi chạy lại `npm install`.

---

## Dừng hệ thống

Vào từng cửa sổ terminal đang chạy backend / frontend, nhấn `Ctrl + C`.
