import { Injectable } from '@nestjs/common';
import type { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { BuildKind, BuildStatus, PullRequestState } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import type { ProjectTable } from 'src/schema/tables/project.table.js';
import { toContainsPattern } from 'src/utils/database.js';

@Injectable()
export class ProjectRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  search({ id, query, repository }: { id?: string; query?: string; repository?: string }) {
    return this.db
      .selectFrom('project')
      .selectAll('project')
      .select((eb) => [
        eb
          .selectFrom('screenshot')
          .select(eb.fn.countAll<number>().as('count'))
          .where('screenshot.sha256', 'is not', null)
          .where(
            'screenshot.buildId',
            '=',
            eb
              .selectFrom('build')
              .select('build.id')
              .whereRef('build.projectId', '=', 'project.id')
              .where('build.kind', '=', BuildKind.Main)
              .where('build.status', '=', BuildStatus.Complete)
              .orderBy('build.createdAt', 'desc')
              .orderBy('build.id', 'desc')
              .limit(1),
          )
          .as('screenshotCount'),
        eb
          .selectFrom('build')
          .innerJoin('pull_request', (join) =>
            join
              .onRef('pull_request.number', '=', 'build.pullRequestNumber')
              .onRef('pull_request.repository', '=', 'project.repository'),
          )
          .select(({ fn }) => fn.count<number>('build.pullRequestNumber').distinct().as('count'))
          .whereRef('build.projectId', '=', 'project.id')
          .where('pull_request.state', '=', PullRequestState.Open)
          .as('openPullRequestCount'),
      ])
      .$if(!!id, (qb) => qb.where('project.id', '=', id as string))
      .$if(!!repository, (qb) => qb.where('project.repository', '=', repository as string))
      .$if(!!query, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb('project.name', 'ilike', toContainsPattern(query as string)),
            eb('project.repository', 'ilike', toContainsPattern(query as string)),
          ]),
        ),
      )
      .orderBy('project.repository')
      .orderBy('project.name')
      .execute();
  }

  upsert(project: Insertable<ProjectTable>) {
    return this.db
      .insertInto('project')
      .values(project)
      .onConflict((conflict) =>
        conflict.columns(['repository', 'name']).doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
