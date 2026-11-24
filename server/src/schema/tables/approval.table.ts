import {
  Column,
  CreateDateColumn,
  ForeignKeyColumn,
  Index,
  PrimaryGeneratedColumn,
  Table,
  type Generated,
  type Timestamp,
} from '@immich/sql-tools';
import type { ScreenshotTheme } from 'src/enum.js';
import { ProjectTable } from 'src/schema/tables/project.table.js';
import { UserTable } from 'src/schema/tables/user.table.js';

@Table('approval')
@Index({ columns: ['projectId', 'name'] })
export class ApprovalTable {
  @PrimaryGeneratedColumn({ strategy: 'uuid-v7' })
  id!: Generated<string>;

  @ForeignKeyColumn(() => ProjectTable, { onUpdate: 'CASCADE', onDelete: 'CASCADE', index: false })
  projectId!: string;

  @Column()
  name!: string;

  @Column()
  theme!: ScreenshotTheme;

  @Column()
  viewport!: string;

  @Column({ nullable: true })
  baselineSha256!: string | null;

  @Column({ nullable: true })
  sha256!: string | null;

  @ForeignKeyColumn(() => UserTable, { onUpdate: 'CASCADE', onDelete: 'CASCADE' })
  userId!: string;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;
}
