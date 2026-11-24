import {
  Column,
  ForeignKeyColumn,
  Index,
  PrimaryGeneratedColumn,
  Table,
  type Generated,
  type Timestamp,
} from '@immich/sql-tools';
import type { ScreenshotStatus, ScreenshotTheme } from 'src/enum.js';
import { ProjectTable } from 'src/schema/tables/project.table.js';
import type { DiffRegion } from 'src/schema/tables/screenshot.table.js';

@Table('screenshot_version')
@Index({ columns: ['projectId', 'name', 'createdAt'] })
export class ScreenshotVersionTable {
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

  @Column({ type: 'integer' })
  width!: number;

  @Column({ type: 'integer' })
  height!: number;

  @Column()
  status!: ScreenshotStatus;

  @Column({ nullable: true })
  sha256!: string | null;

  @Column({ nullable: true })
  baselineSha256!: string | null;

  @Column({ nullable: true })
  diffSha256!: string | null;

  @Column({ type: 'double precision', nullable: true })
  diffRatio!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  diffRegions!: DiffRegion[] | null;

  @Column()
  commit!: string;

  @Column({ type: 'timestamp with time zone' })
  createdAt!: Timestamp;
}
