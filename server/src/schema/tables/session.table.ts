import {
  Column,
  CreateDateColumn,
  ForeignKeyColumn,
  PrimaryGeneratedColumn,
  Table,
  UpdateDateColumn,
  type Generated,
  type Timestamp,
} from '@immich/sql-tools';
import { UserTable } from 'src/schema/tables/user.table.js';

@Table('session')
export class SessionTable {
  @PrimaryGeneratedColumn({ strategy: 'uuid-v7' })
  id!: Generated<string>;

  @Column({ unique: true })
  token!: string;

  @ForeignKeyColumn(() => UserTable, { onUpdate: 'CASCADE', onDelete: 'CASCADE' })
  userId!: string;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;

  @UpdateDateColumn()
  updatedAt!: Generated<Timestamp>;

  @Column({ type: 'timestamp with time zone' })
  expiresAt!: Timestamp;
}
