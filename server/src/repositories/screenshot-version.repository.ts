import { Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { Constants } from 'src/constants.js';
import { ScreenshotStatus, type ScreenshotTheme } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { toContainsPattern } from 'src/utils/database.js';

export type ScreenshotVersionSearchOptions = {
  id?: string;
  projectId?: string;
  name?: string;
  theme?: ScreenshotTheme;
  viewport?: string;
};

export type ScreenshotHistoryDay = { projectId: string; date: string; screenshotCount: number };

@Injectable()
export class ScreenshotVersionRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  search({ id, projectId, name, theme, viewport }: ScreenshotVersionSearchOptions) {
    return this.db
      .selectFrom('screenshot_version')
      .innerJoin('project', 'project.id', 'screenshot_version.projectId')
      .selectAll('screenshot_version')
      .select('project.repository')
      .$if(!!id, (qb) => qb.where('screenshot_version.id', '=', id as string))
      .$if(!!projectId, (qb) => qb.where('screenshot_version.projectId', '=', projectId as string))
      .$if(!!name, (qb) => qb.where('screenshot_version.name', '=', name as string))
      .$if(!!theme, (qb) => qb.where('screenshot_version.theme', '=', theme as ScreenshotTheme))
      .$if(!!viewport, (qb) => qb.where('screenshot_version.viewport', '=', viewport as string))
      .orderBy('screenshot_version.createdAt', 'desc')
      .orderBy('screenshot_version.name')
      .orderBy('screenshot_version.viewport')
      .orderBy('screenshot_version.theme', 'desc')
      .limit(Constants.ScreenshotVersions.PageSize)
      .execute();
  }

  searchScreens({ projectId, query }: { projectId?: string; query?: string }) {
    return this.db
      .selectFrom('screenshot_version')
      .select(['projectId', 'name'])
      .select(({ fn }) => [
        fn.count<number>('commit').distinct().as('versionCount'),
        fn.max('createdAt').as('updatedAt'),
      ])
      .$if(!!projectId, (qb) => qb.where('projectId', '=', projectId as string))
      .$if(!!query, (qb) => qb.where('name', 'ilike', toContainsPattern(query as string)))
      .groupBy(['projectId', 'name'])
      .orderBy('name')
      .orderBy('projectId')
      .limit(Constants.Screens.PageSize)
      .execute();
  }

  async getHistory(since: Date): Promise<ScreenshotHistoryDay[]> {
    const { rows } = await sql<ScreenshotHistoryDay>`
      with days as (
        select distinct "projectId", ("createdAt" at time zone 'UTC')::date as date
        from screenshot_version
        where "createdAt" >= ${since}
        union
        select distinct "projectId", (${since}::timestamptz at time zone 'UTC')::date
        from screenshot_version
        where "createdAt" < ${since}
      )
      select
        days."projectId",
        to_char(days.date, 'YYYY-MM-DD') as date,
        (
          select count(*)::int
          from (
            select distinct on (version.name, version.theme, version.viewport) version.status
            from screenshot_version version
            where version."projectId" = days."projectId"
              and version."createdAt" < ((days.date + 1)::timestamp at time zone 'UTC')
            order by version.name, version.theme, version.viewport, version."createdAt" desc, version.id desc
          ) latest
          where latest.status != ${ScreenshotStatus.Removed}
        ) as "screenshotCount"
      from days
      order by days.date, days."projectId"
    `.execute(this.db);

    return rows;
  }

  async createFromBuild(buildId: string): Promise<void> {
    await this.db
      .insertInto('screenshot_version')
      .columns([
        'projectId',
        'name',
        'theme',
        'viewport',
        'width',
        'height',
        'status',
        'sha256',
        'baselineSha256',
        'diffSha256',
        'diffRatio',
        'diffRegions',
        'commit',
        'createdAt',
      ])
      .expression((eb) =>
        eb
          .selectFrom('screenshot')
          .innerJoin('build', 'build.id', 'screenshot.buildId')
          .select([
            'build.projectId',
            'screenshot.name',
            'screenshot.theme',
            'screenshot.viewport',
            'screenshot.width',
            'screenshot.height',
            'screenshot.status',
            'screenshot.sha256',
            'screenshot.baselineSha256',
            'screenshot.diffSha256',
            'screenshot.diffRatio',
            'screenshot.diffRegions',
            'build.commit',
            'build.createdAt',
          ])
          .where('screenshot.buildId', '=', buildId)
          .where('screenshot.status', '!=', ScreenshotStatus.Unchanged),
      )
      .execute();
  }
}
