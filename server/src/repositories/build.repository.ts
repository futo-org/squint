import { Injectable } from '@nestjs/common';
import { sql, type Insertable, type Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { Constants } from 'src/constants.js';
import { BuildKind, BuildStatus, PullRequestState, ReviewStatus, ScreenshotStatus } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import type { BuildTable } from 'src/schema/tables/build.table.js';
import type { DiffRegion } from 'src/schema/tables/screenshot.table.js';
import { isSame, toContainsPattern, toPrefixPattern } from 'src/utils/database.js';

export type BuildDiff = { screenshotId: string; sha256: string; ratio: number; regions: DiffRegion[] };

export type BuildSearchOptions = {
  id?: string;
  projectId?: string;
  query?: string;
  kind?: BuildKind;
  status?: BuildStatus;
  pullRequestState?: PullRequestState;
  branch?: string;
  review?: ReviewStatus;
  isTrashed?: boolean;
};

const outdated = sql<boolean>`(
  exists (
    select 1 from build newer
    where newer."projectId" = build."projectId"
      and newer."pullRequestNumber" is not distinct from build."pullRequestNumber"
      and newer.release is not distinct from build.release
      and newer.status = ${BuildStatus.Complete}
      and (newer."createdAt", newer.id) > (build."createdAt", build.id)
  )
  or exists (
    select 1 from pull_request
    inner join project on project.repository = pull_request.repository
    where project.id = build."projectId"
      and pull_request.number = build."pullRequestNumber"
      and pull_request.state != ${PullRequestState.Open}
  )
)`;

const review = sql<ReviewStatus | null>`case
  when build.status != ${BuildStatus.Complete} then null
  when build."reviewableCount" = 0 then ${ReviewStatus.Unchanged}
  when build."approvedCount" >= build."reviewableCount" then ${ReviewStatus.Approved}
  when build."pullRequestState" = ${PullRequestState.Open} and build."isLatest" then ${ReviewStatus.NeedsReview}
end`;

@Injectable()
export class BuildRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  search(options: BuildSearchOptions) {
    const { id, projectId, query, kind, status, pullRequestState, branch, review: reviewStatus, isTrashed } = options;
    const text = query ?? '';
    const pullRequestNumber = Constants.Builds.PullRequestQuery.exec(text)?.[1];
    const contains = toContainsPattern(text);
    const prefix = toPrefixPattern(text.toLowerCase());

    return this.selectDetails()
      .where('build.deletedAt', isTrashed ? 'is not' : 'is', null)
      .$if(!!id, (qb) => qb.where('build.id', '=', id as string))
      .$if(!!projectId, (qb) => qb.where('build.projectId', '=', projectId as string))
      .$if(!!kind, (qb) => qb.where('build.kind', '=', kind as BuildKind))
      .$if(!!status, (qb) => qb.where('build.status', '=', status as BuildStatus))
      .$if(!!pullRequestState, (qb) => qb.where('build.pullRequestState', '=', pullRequestState as PullRequestState))
      .$if(!!branch, (qb) => qb.where('build.branch', '=', branch as string))
      .$if(!!reviewStatus, (qb) => qb.where(review, '=', reviewStatus as ReviewStatus))
      .$if(!!query, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb('build.branch', 'ilike', contains),
            eb('build.commit', 'like', prefix),
            eb('build.pullRequestTitle', 'ilike', contains),
            eb('build.release', 'ilike', contains),
            ...(pullRequestNumber ? [eb('build.pullRequestNumber', '=', Number(pullRequestNumber))] : []),
          ]),
        ),
      )
      .orderBy('build.createdAt', 'desc')
      .orderBy('build.id', 'desc')
      .limit(Constants.Builds.PageSize)
      .execute();
  }

  getById(id: string) {
    return this.selectDetails().where('build.id', '=', id).executeTakeFirst();
  }

  getBaseline({ id, projectId, kind }: { id: string; projectId: string; kind: BuildKind }) {
    return this.db
      .selectFrom('build')
      .select('id')
      .where('projectId', '=', projectId)
      .where('kind', '=', kind === BuildKind.Release ? BuildKind.Release : BuildKind.Main)
      .where('status', '=', BuildStatus.Complete)
      .where('id', '!=', id)
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst();
  }

  async setBaseline(id: string, baselineBuildId: string | null): Promise<void> {
    await this.db.updateTable('build').set({ baselineBuildId }).where('id', '=', id).execute();
  }

  async complete({ id, diffs }: { id: string; diffs: BuildDiff[] }): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      for (const { screenshotId, sha256, ratio, regions } of diffs) {
        await tx
          .updateTable('screenshot')
          .set({ diffSha256: sha256, diffRatio: ratio, diffRegions: regions })
          .where('id', '=', screenshotId)
          .execute();
      }

      await tx
        .updateTable('build')
        .set({ status: BuildStatus.Complete, completedAt: new Date() })
        .where('id', '=', id)
        .execute();
    });
  }

  async trashOutdated(now: Date): Promise<string[]> {
    const rows = await this.db
      .updateTable('build')
      .set({ deletedAt: now })
      .where('deletedAt', 'is', null)
      .where(outdated)
      .returning('id')
      .execute();

    return rows.map(({ id }) => id);
  }

  async restoreRetained(): Promise<string[]> {
    const rows = await this.db
      .updateTable('build')
      .set({ deletedAt: null })
      .where('deletedAt', 'is not', null)
      .where(sql<boolean>`not ${outdated}`)
      .returning('id')
      .execute();

    return rows.map(({ id }) => id);
  }

  async deleteTrashedBefore(before: Date): Promise<string[]> {
    const rows = await this.db.deleteFrom('build').where('deletedAt', '<=', before).returning('id').execute();

    return rows.map(({ id }) => id);
  }

  create(build: Insertable<BuildTable>) {
    return this.db.insertInto('build').values(build).returning('id').executeTakeFirstOrThrow();
  }

  private selectDetails() {
    return this.db.selectFrom(this.selectCounts().as('build')).selectAll('build').select(review.as('review'));
  }

  private selectCounts() {
    return this.db
      .selectFrom('build')
      .innerJoin('project', 'project.id', 'build.projectId')
      .leftJoin('pull_request', (join) =>
        join
          .onRef('pull_request.repository', '=', 'project.repository')
          .onRef('pull_request.number', '=', 'build.pullRequestNumber'),
      )
      .selectAll('build')
      .select([
        'project.repository',
        'pull_request.title as pullRequestTitle',
        'pull_request.state as pullRequestState',
      ])
      .select((eb) => [
        eb
          .selectFrom('screenshot')
          .select(({ fn }) => fn.count<number>('screenshot.name').distinct().as('count'))
          .whereRef('screenshot.buildId', '=', 'build.id')
          .where('screenshot.status', '!=', ScreenshotStatus.Unchanged)
          .as('reviewableCount'),
        eb
          .selectFrom((qb) =>
            qb
              .selectFrom('screenshot')
              .leftJoin('approval', (join) =>
                join
                  .onRef('approval.projectId', '=', 'build.projectId')
                  .onRef('approval.name', '=', 'screenshot.name')
                  .onRef('approval.theme', '=', 'screenshot.theme')
                  .onRef('approval.viewport', '=', 'screenshot.viewport')
                  .on(isSame('approval.baselineSha256', 'screenshot.baselineSha256'))
                  .on(isSame('approval.sha256', 'screenshot.sha256')),
              )
              .select('screenshot.name')
              .whereRef('screenshot.buildId', '=', 'build.id')
              .where('screenshot.status', '!=', ScreenshotStatus.Unchanged)
              .groupBy('screenshot.name')
              .having((having) => having(having.fn.count('approval.id'), '=', having.fn.countAll()))
              .as('approved_screen'),
          )
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .as('approvedCount'),
        eb
          .not(
            eb.exists(
              eb
                .selectFrom('build as newer')
                .select('newer.id')
                .whereRef('newer.projectId', '=', 'build.projectId')
                .whereRef('newer.pullRequestNumber', '=', 'build.pullRequestNumber')
                .where('newer.status', '=', BuildStatus.Complete)
                .where(sql<boolean>`(newer."createdAt", newer.id) > (build."createdAt", build.id)`),
            ),
          )
          .as('isLatest'),
      ]);
  }
}
