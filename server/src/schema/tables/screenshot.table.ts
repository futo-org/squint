import {
  Column,
  CreateDateColumn,
  ForeignKeyColumn,
  PrimaryGeneratedColumn,
  Table,
  Unique,
  type Generated,
  type Timestamp,
} from '@immich/sql-tools';
import type { ScreenshotStatus, ScreenshotTheme } from 'src/enum.js';
import { BuildTable } from 'src/schema/tables/build.table.js';

export type DiffRegion = { x: number; y: number; width: number; height: number };

@Table('screenshot')
@Unique({ columns: ['buildId', 'name', 'theme', 'viewport'] })
export class ScreenshotTable {
  @PrimaryGeneratedColumn({ strategy: 'uuid-v7' })
  id!: Generated<string>;

  @ForeignKeyColumn(() => BuildTable, { onUpdate: 'CASCADE', onDelete: 'CASCADE', index: false })
  buildId!: string;

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

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;
}
