import { Injectable } from '@nestjs/common';
import { sql, type Insertable, type Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { Constants } from 'src/constants.js';
import type { DB } from 'src/schema/index.js';
import type { BlobTable } from 'src/schema/tables/blob.table.js';

@Injectable()
export class BlobRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  get(sha256: string) {
    return this.db.selectFrom('blob').selectAll().where('sha256', '=', sha256).executeTakeFirst();
  }

  async getExisting(sha256s: string[]): Promise<Set<string>> {
    if (sha256s.length === 0) {
      return new Set();
    }

    const rows = await this.db.selectFrom('blob').select('sha256').where('sha256', 'in', sha256s).execute();

    return new Set(rows.map(({ sha256 }) => sha256));
  }

  async createIfMissing(blob: Insertable<BlobTable>, store: () => Promise<void>): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      await sql`select pg_advisory_xact_lock_shared(${Constants.Database.BlobLockKey})`.execute(tx);
      const existing = await tx
        .selectFrom('blob')
        .select('sha256')
        .where('sha256', '=', blob.sha256)
        .executeTakeFirst();
      if (existing) {
        return;
      }

      await store();
      await tx
        .insertInto('blob')
        .values(blob)
        .onConflict((conflict) => conflict.column('sha256').doNothing())
        .execute();
    });
  }

  deleteUnreferenced(before: Date, remove: (sha256s: string[]) => Promise<void>): Promise<number> {
    return this.db.transaction().execute(async (tx) => {
      await sql`select pg_advisory_xact_lock(${Constants.Database.BlobLockKey})`.execute(tx);
      const rows = await tx
        .deleteFrom('blob')
        .where('blob.createdAt', '<', before)
        .where(({ and, not, exists, selectFrom }) =>
          and(
            Constants.Blobs.ReferenceTables.flatMap((table) =>
              Constants.Blobs.ReferenceColumns.map((column) =>
                not(exists(selectFrom(table).select(`${table}.id`).whereRef(`${table}.${column}`, '=', 'blob.sha256'))),
              ),
            ),
          ),
        )
        .returning('blob.sha256')
        .execute();
      await remove(rows.map(({ sha256 }) => sha256));

      return rows.length;
    });
  }
}
