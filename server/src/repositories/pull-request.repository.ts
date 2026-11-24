import { Injectable } from '@nestjs/common';
import type { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from 'src/schema/index.js';
import type { PullRequestTable } from 'src/schema/tables/pull-request.table.js';

@Injectable()
export class PullRequestRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  async createIfMissing(pullRequest: Insertable<PullRequestTable>): Promise<void> {
    await this.db
      .insertInto('pull_request')
      .values(pullRequest)
      .onConflict((conflict) => conflict.columns(['repository', 'number']).doNothing())
      .execute();
  }

  async upsert(pullRequest: Insertable<PullRequestTable>): Promise<void> {
    await this.db
      .insertInto('pull_request')
      .values(pullRequest)
      .onConflict((conflict) =>
        conflict.columns(['repository', 'number']).doUpdateSet((eb) => ({
          title: eb.ref('excluded.title'),
          state: eb.ref('excluded.state'),
          updatedAt: eb.ref('excluded.updatedAt'),
        })),
      )
      .execute();
  }
}
