# Bug Report — ICTU Calendar — 2026-06-08

## BUG 1: Email đính kèm file bị lỗi (MinIO vs disk)
**File:** `be/src/modules/notification/notification.service.ts` dòng 119-123  
**Mức độ:** Lỗi thực — attachment không được gửi, lỗi bị nuốt im lặng

**Nguyên nhân:**
```typescript
// Code hiện tại — SAI
const mailAttachments = attachments.map((a) => ({
  filename: a.originalName,
  path: path.join(process.cwd(), 'uploads', a.filename), // ← đọc từ disk, nhưng file ở MinIO
  contentType: a.mimeType,
}));
```
File được lưu trên **MinIO** qua `StorageService.upload()`, không tồn tại trên local disk.

**Cách sửa:** Stream file từ MinIO rồi dùng `content` thay vì `path`:
```typescript
// Trong sendBulk, cần inject StorageService
// Thay path bằng content (Buffer download từ MinIO)
const mailAttachments = await Promise.all(
  attachments.map(async (a) => ({
    filename: a.originalName,
    content: await this.storageService.getBuffer(a.filename), // cần thêm method getBuffer
    contentType: a.mimeType,
  }))
);
```
Hoặc đơn giản hơn: **bỏ attachment khỏi email**, chỉ giữ phần text liệt kê tên file (đã có sẵn trong `attachmentsBlock` trong HTML body). Email hiện tại đã hiển thị tên file dạng text rồi.

---

## BUG 2: Crash 500 khi Google OAuth user đổi mật khẩu
**File:** `be/src/modules/users/users.service.ts` dòng 134  
**Mức độ:** Lỗi thực — 500 Internal Server Error

**Nguyên nhân:**
```typescript
async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await this.usersRepository...getOne();
  if (!user) throw new NotFoundException(...);
  const match = await bcrypt.compare(currentPassword, user.password); // ← user.password = null nếu Google user
  // bcrypt.compare(str, null) → throws "data and hash arguments required"
```
User đăng nhập bằng Google có `password = null`. Không có guard nào ngăn họ gọi `POST /auth/change-password`.

**Cách sửa:** Thêm check đầu hàm:
```typescript
if (!user.password) {
  throw new BadRequestException('Tài khoản đăng nhập bằng Google không sử dụng mật khẩu');
}
```

---

## BUG 3: GoogleToken không có CASCADE khi xóa user
**File:** `be/src/modules/calendar/entities/google-token.entity.ts`  
**Mức độ:** Lỗi DB — orphan records tích lũy vĩnh viễn

**Nguyên nhân:**
```typescript
@Entity('google_tokens')
export class GoogleToken {
  @Column({ unique: true })
  userId: string;  // ← chỉ là string, không có @ManyToOne / @JoinColumn
  // → không có FK constraint, không có ON DELETE CASCADE
}
```
Khi admin xóa user, bản ghi `google_tokens` của user đó không bị xóa theo.

**Cách sửa:** Thêm relation:
```typescript
import { ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Trong class GoogleToken:
@ManyToOne(() => User, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'userId' })
user: User;
```
Sau đó chạy migration để cập nhật schema.

---

## BUG 4: `hasAnyAction` logic thừa và quá rộng
**File:** `fe/src/app/features/calendar/components/calendar-view/calendar-view.component.ts` dòng 208-213  
**Mức độ:** Logic sai — editor thấy action menu trên MỌI event

**Nguyên nhân:**
```typescript
hasAnyAction(event: CalendarEvent): boolean {
  if (this.authService.isApprover() && !this.authService.isEditor() && event.status === 'pending') return true;
  if (this.authService.isEditor() && this.canEditEvent(event)) return true;
  if (this.authService.isApprover() && event.status === 'approved') return true;      // ← dòng này
  if (this.authService.isApprover() && (event.status === 'approved' || event.status === 'pending')) return true; // ← bao gồm dòng trên, thừa
  if (this.authService.isEditor()) return true; // ← LUÔN true cho mọi editor, không xét ownership
  return false;
}
```
Dòng 3 thừa (dòng 4 đã bao gồm). Dòng 5 khiến mọi editor luôn có action, kể cả event người khác.

**Cách sửa:**
```typescript
hasAnyAction(event: CalendarEvent): boolean {
  if (this.authService.isAdmin()) return true;
  if (this.authService.isApprover() && (event.status === 'approved' || event.status === 'pending')) return true;
  if (this.authService.isEditor() && this.canEditEvent(event)) return true;
  return false;
}
```

---

## BUG 5: Thời gian hiển thị HH:MM:SS trong email
**File:** `be/src/modules/notification/notification.service.ts` dòng 168  
**Mức độ:** UX — email hiển thị "08:00:00 – 10:00:00" thay vì "08:00 – 10:00"

**Nguyên nhân:**
```typescript
const timeStr = event.allDay
  ? 'Cả ngày'
  : [event.startTime, event.endTime].filter(Boolean).join(' – ');
// MySQL TIME type trả về "HH:MM:SS"
```

**Cách sửa:**
```typescript
const fmt = (t?: string | null) => t?.slice(0, 5) ?? null;
const timeStr = event.allDay
  ? 'Cả ngày'
  : [fmt(event.startTime), fmt(event.endTime)].filter(Boolean).join(' – ');
```

---

## BUG 6: `updateDepartment` không validate departmentId tồn tại
**File:** `be/src/modules/auth/auth.controller.ts` dòng 130-135  
**Mức độ:** Thiếu guard — user có thể gán UUID ngẫu nhiên làm departmentId

**Nguyên nhân:**
```typescript
async updateDepartment(@Req() req: any, @Body('departmentId') departmentId: string) {
  if (!departmentId) throw new BadRequestException('departmentId là bắt buộc');
  await this.usersService.update(req.user.sub, { departmentId }); // ← không check dept có tồn tại không
```

**Cách sửa:** Thêm validate trong `DepartmentsService` hoặc trực tiếp:
```typescript
const dept = await this.departmentsService.findOne(departmentId);
if (!dept) throw new BadRequestException('Phòng ban không tồn tại');
await this.usersService.update(req.user.sub, { departmentId });
```

---

## BUG 7: XSS tiềm ẩn trong export PDF
**File:** `fe/src/app/features/calendar/components/calendar-view/calendar-view.component.ts` dòng 1362, 1380-1387  
**Mức độ:** Rủi ro thấp (same-origin window) nhưng nên sửa

**Nguyên nhân:**
```typescript
const empty = (v?: string | null) => v ? v : '<span class="td-empty">—</span>';
// ...
`<td class="col-participants">${empty(e.participants)}</td>` // ← không escape HTML
`<td class="col-title"><strong>${e.title}</strong></td>`     // ← không escape
```

**Cách sửa:** Thêm hàm escape:
```typescript
const esc = (v?: string | null) => (v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const empty = (v?: string | null) => v ? esc(v) : '<span class="td-empty">—</span>';
```

---

## Tóm tắt ưu tiên sửa

| # | Bug | Ưu tiên |
|---|-----|---------|
| 2 | Google user crash 500 khi đổi mật khẩu | 🔴 Cao nhất |
| 3 | GoogleToken orphan — thiếu CASCADE | 🔴 Cao |
| 1 | Email attachment đọc sai đường dẫn | 🟠 Cao |
| 4 | hasAnyAction logic sai | 🟡 Trung bình |
| 5 | Email hiển thị HH:MM:SS | 🟡 Trung bình |
| 6 | updateDepartment không validate | 🟡 Trung bình |
| 7 | XSS trong PDF export | 🟢 Thấp |
