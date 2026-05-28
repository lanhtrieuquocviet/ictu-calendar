import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_tokens')
export class GoogleToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({ type: 'text' })
  accessToken: string;

  @Column({ type: 'text', nullable: true })
  refreshToken: string | null;

  @Column({ nullable: true })
  tokenExpiry: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
