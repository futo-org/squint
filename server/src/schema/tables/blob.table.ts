import { Column, CreateDateColumn, PrimaryColumn, Table, type Generated, type Timestamp } from '@immich/sql-tools';

@Table('blob')
export class BlobTable {
  @PrimaryColumn()
  sha256!: string;

  @Column({ type: 'integer' })
  size!: number;

  @CreateDateColumn()
  createdAt!: Generated<Timestamp>;
}
