import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Table,
  Unique,
  type Generated,
  type Timestamp,
} from '@immich/sql-tools';

@Table('project')
@Unique({ columns: ['repository', 'name'] })
export class ProjectTable {
  @PrimaryGeneratedColumn({ strategy: 'uuid-v7' })
  id!: Generated<string>;

  @Column()
  repository!: string;

  @Column()
  name!: string;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;
}
