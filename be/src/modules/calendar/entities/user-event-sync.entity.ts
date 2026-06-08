import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('user_event_syncs')
@Index(['userId', 'eventId'], { unique: true })
export class UserEventSync {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  eventId: string;

  @Column({ nullable: true })
  googleEventId: string;

  @CreateDateColumn()
  syncedAt: Date;
}
