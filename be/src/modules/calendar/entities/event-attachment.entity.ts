import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity('event_attachments')
export class EventAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  @Column()
  filename: string;       // Tên file lưu trên disk (UUID + ext)

  @Column()
  originalName: string;   // Tên gốc do người dùng upload

  @Column()
  mimeType: string;

  @Column({ type: 'bigint' })
  size: number;           // bytes

  @Column({ nullable: true })
  uploadedByName: string;

  @CreateDateColumn()
  createdAt: Date;
}
