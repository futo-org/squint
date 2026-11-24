import { Injectable } from '@nestjs/common';
import type { Insertable, Kysely, Selectable } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { Constants } from 'src/constants.js';
import type { DB } from 'src/schema/index.js';
import type { ScreenshotTable } from 'src/schema/tables/screenshot.table.js';
import { chunk } from 'src/utils/misc.js';

@Injectable()
export class ScreenshotRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  getByBuildId(buildId: string) {
    return this.db
      .selectFrom('screenshot')
      .selectAll()
      .where('buildId', '=', buildId)
      .orderBy('name')
      .orderBy('viewport')
      .orderBy('theme', 'desc')
      .execute();
  }

  replaceByBuildId(
    buildId: string,
    screenshots: Insertable<ScreenshotTable>[],
  ): Promise<Selectable<ScreenshotTable>[]> {
    return this.db.transaction().execute(async (tx) => {
      await tx.deleteFrom('screenshot').where('buildId', '=', buildId).execute();

      const created: Selectable<ScreenshotTable>[] = [];
      for (const rows of chunk(screenshots, Constants.Database.InsertBatchSize)) {
        created.push(...(await tx.insertInto('screenshot').values(rows).returningAll().execute()));
      }

      return created;
    });
  }
}
