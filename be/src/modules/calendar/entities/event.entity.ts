import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum EventStatus {
  PENDING = 'pending',     // Chờ duyệt
  APPROVED = 'approved',   // Đồng ý
  REJECTED = 'rejected',   // Từ chối
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Thông tin cơ bản ──────────────────────────────

  @Column()
  title: string;               // Nội dung cuộc họp/sự kiện

  @Column({ type: 'date' })
  eventDate: Date;             // Thứ/ngày/tháng

  @Column({ type: 'time', nullable: true })
  startTime: string;           // Giờ bắt đầu (VD: "08:00")

  @Column({ type: 'time', nullable: true })
  endTime: string;             // Giờ kết thúc (VD: "10:00")

  @Column({ default: false })
  allDay: boolean;             // Cả ngày

  // ── Thông tin tổ chức ─────────────────────────────

  @Column({ nullable: true, type: 'text' })
  participants: string;        // Thành phần tham dự

  @Column({ nullable: true })
  organizingUnit: string;      // Đơn vị chủ trì và chuẩn bị

  @Column({ nullable: true })
  location: string;            // Địa điểm (VD: Phòng họp số 1)

  // ── Hậu cần ───────────────────────────────────────

  @Column({ nullable: true })
  vehicleArrangement: string;  // Điều xe (VD: Xe 00715)

  @Column({ nullable: true })
  mediaUnit: string;           // Truyền thông (đơn vị phụ trách)

  // ── Phê duyệt ─────────────────────────────────────

  @Column({ nullable: true })
  supervisor: string;          // ĐU/BGH Chỉ đạo (VD: PGS.TS. Phùng Trung Nghĩa)

  @Column({ nullable: true })
  approvedBy: string;          // ĐU/BGH Phê duyệt (VD: Đồng ý)

  @Column({ nullable: true })
  meetingCode: string;         // Mã cuộc họp (VD: 26.21.01)

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.PENDING,
  })
  status: EventStatus;

  // ── Hiển thị ──────────────────────────────────────

  @Column({ nullable: true, default: '#4f46e5' })
  color: string;               // Màu hiển thị trên calendar

  @Column({ nullable: true, type: 'text' })
  notes: string;               // Ghi chú thêm

  @Column({ nullable: true, type: 'text' })
  rejectionReason: string;     // Lý do từ chối (do approver điền)

  @Column({ nullable: true })
  createdByName: string;       // Họ tên người tạo lịch (tự động ghi)

  @Column({ nullable: true })
  approvedByName: string;      // Họ tên người phê duyệt (tự động ghi)

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;            // Thời điểm phê duyệt (tự động ghi)

  // ── Quan hệ ───────────────────────────────────────

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;              // Người tạo lịch

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
