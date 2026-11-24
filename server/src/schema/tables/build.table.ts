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
import { BuildStatus, type BuildKind } from 'src/enum.js';
import { ProjectTable } from 'src/schema/tables/project.table.js';

@Table('build')
@Index({ columns: ['projectId', 'createdAt'] })
export class BuildTable {
  @PrimaryGeneratedColumn({ strategy: 'uuid-v7' })
  id!: Generated<string>;

  @ForeignKeyColumn(() => ProjectTable, { onUpdate: 'CASCADE', onDelete: 'CASCADE', index: false })
  projectId!: string;

  @Column()
  kind!: BuildKind;

  @Column()
  branch!: string;

  @Column()
  commit!: string;

  @Column({ type: 'integer', nullable: true })
  pullRequestNumber!: number | null;

  @Column({ nullable: true })
  release!: string | null;

  @Column({ default: BuildStatus.Pending })
  status!: Generated<BuildStatus>;

  @ForeignKeyColumn(() => BuildTable, { onUpdate: 'CASCADE', onDelete: 'SET NULL', nullable: true })
  baselineBuildId!: string | null;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt!: Timestamp | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deletedAt!: Timestamp | null;
}
