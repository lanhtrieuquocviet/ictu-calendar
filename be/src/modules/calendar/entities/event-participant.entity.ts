import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';

export enum ParticipantType {
  USER = 'user',           // Người có tài khoản trong hệ thống
  DEPARTMENT = 'department', // Cả phòng/đơn vị
  EXTERNAL = 'external',   // Khách bên ngoài (không có tài khoản)
}

@Entity('event_participants')
export class EventParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  @Column({ type: 'enum', enum: ParticipantType })
  type: ParticipantType;

  // type = USER
  @Column({ nullable: true })
  userId: string;

  // type = DEPARTMENT
  @Column({ nullable: true })
  departmentId: string;

  // Tên hiển thị (lưu snapshot để không bị ảnh hưởng khi đổi tên)
  @Column()
  displayName: string;

  // type = EXTERNAL hoặc USER fallback
  @Column({ nullable: true })
  email: string;

  @CreateDateColumn()
  createdAt: Date;
}
