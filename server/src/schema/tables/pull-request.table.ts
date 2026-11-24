import {
  Column,
  CreateDateColumn,
  PrimaryColumn,
  Table,
  UpdateDateColumn,
  type Generated,
  type Timestamp,
} from '@immich/sql-tools';
import type { PullRequestState } from 'src/enum.js';

@Table('pull_request')
export class PullRequestTable {
  @PrimaryColumn()
  repository!: string;

  @PrimaryColumn({ type: 'integer' })
  number!: number;

  @Column({ nullable: true })
  title!: string | null;

  @Column()
  state!: PullRequestState;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;

  @UpdateDateColumn()
  updatedAt!: Generated<Timestamp>;
}
