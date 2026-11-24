import { Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from 'src/schema/index.js';
import type { ApprovalTable } from 'src/schema/tables/approval.table.js';
import { isSame, isSameValue } from 'src/utils/database.js';

type Change = Pick<ApprovalTable, 'projectId' | 'name' | 'theme' | 'viewport' | 'baselineSha256' | 'sha256'>;

@Injectable()
export class ApprovalRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  getByBuildId(buildId: string) {
    return this.db
      .selectFrom('screenshot')
      .innerJoin('build', 'build.id', 'screenshot.buildId')
      .innerJoin('approval', (join) =>
        join
          .onRef('approval.projectId', '=', 'build.projectId')
          .onRef('approval.name', '=', 'screenshot.name')
          .onRef('approval.theme', '=', 'screenshot.theme')
          .onRef('approval.viewport', '=', 'screenshot.viewport')
          .on(isSame('approval.baselineSha256', 'screenshot.baselineSha256'))
          .on(isSame('approval.sha256', 'screenshot.sha256')),
      )
      .innerJoin('user', 'user.id', 'approval.userId')
      .where('screenshot.buildId', '=', buildId)
      .select(['screenshot.id as screenshotId', 'approval.userId', 'user.name as userName', 'approval.createdAt'])
      .execute();
  }

  async createMany(approvals: Array<Change & { userId: string }>): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      for (const approval of approvals) {
        await this.deleteChange(tx, approval).execute();
        await tx.insertInto('approval').values(approval).execute();
      }
    });
  }

  async deleteMany(changes: Change[]): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      for (const change of changes) {
        await this.deleteChange(tx, change).execute();
      }
    });
  }

  private deleteChange(db: Kysely<DB>, change: Change) {
    return db
      .deleteFrom('approval')
      .where('projectId', '=', change.projectId)
      .where('name', '=', change.name)
      .where('theme', '=', change.theme)
      .where('viewport', '=', change.viewport)
      .where(isSameValue('baselineSha256', change.baselineSha256))
      .where(isSameValue('sha256', change.sha256));
  }
}
