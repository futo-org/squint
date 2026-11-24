import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Table,
  UpdateDateColumn,
  type Generated,
  type Timestamp,
} from '@immich/sql-tools';
import type { UserRole } from 'src/enum.js';

@Table('user')
export class UserTable {
  @PrimaryGeneratedColumn({ strategy: 'uuid-v7' })
  id!: Generated<string>;

  @Column({ unique: true })
  oauthId!: string;

  @Column()
  email!: string;

  @Column()
  name!: string;

  @Column()
  role!: UserRole;

  @Column({ nullable: true })
  avatarUrl!: string | null;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;

  @UpdateDateColumn()
  updatedAt!: Generated<Timestamp>;
}
