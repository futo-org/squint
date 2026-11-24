import type { Kysely } from 'kysely';
import type { ProjectSearchDto } from 'src/dtos/project.dto.js';
import { BuildKind } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { ProjectService } from 'src/services/project.service.js';
import { type MediumContext, newMediumContext } from 'test/medium.factory.js';
import { getKyselyDB, newCiAuth } from 'test/utils.js';

const main = { project: 'ui', kind: BuildKind.Main, branch: 'main', commit: 'a'.repeat(40) };
const pullRequest = {
  project: 'ui',
  kind: BuildKind.PullRequest,
  branch: 'feat/x',
  commit: 'b'.repeat(40),
  pullRequestNumber: 7,
};

describe(ProjectService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: ProjectService;

  const auth = newCiAuth();

  const getProject = async (name = 'ui') => {
    const projects = await sut.search({});

    return projects.find((project) => project.name === name);
  };

  beforeEach(async () => {
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.projectService;
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('search', () => {
    it('counts the screenshots of the latest complete main build', async () => {
      await ctx.publishBuild(auth, main, { button: 'button-v1', alert: 'alert-v1' });
      await ctx.publishBuild(auth, pullRequest, { button: 'button-v1', card: 'card-v1', input: 'i' });

      await ctx.buildService.create(auth, { ...main, commit: 'c'.repeat(40) });

      await expect(getProject()).resolves.toMatchObject({ screenshotCount: 2 });
    });

    it('does not count screenshots that the latest main build removed', async () => {
      await ctx.publishBuild(auth, main, { button: 'button-v1', alert: 'alert-v1' });

      await ctx.publishBuild(auth, { ...main, commit: 'c'.repeat(40) }, { button: 'button-v1' });

      await expect(getProject()).resolves.toMatchObject({ screenshotCount: 1 });
    });

    it('counts the open pull requests that have builds in the project', async () => {
      const merged = { action: 'closed', repository: { full_name: 'immich-app/static-pages' } };
      await ctx.buildService.create(auth, pullRequest);
      await ctx.buildService.create(auth, { ...pullRequest, commit: 'c'.repeat(40) });
      await ctx.buildService.create(auth, { ...pullRequest, pullRequestNumber: 8 });
      await ctx.buildService.create(auth, { ...pullRequest, pullRequestNumber: 9 });

      await ctx.deliverWebhook('pull_request', {
        ...merged,
        pull_request: { number: 9, title: 'Merged', state: 'closed', merged: true },
      });

      await expect(getProject()).resolves.toMatchObject({ openPullRequestCount: 2 });
    });

    it('keeps the counts of each project apart', async () => {
      await ctx.publishBuild(auth, main, { button: 'button-v1' });
      await ctx.buildService.create(auth, pullRequest);

      await ctx.buildService.create(auth, { ...main, project: 'root' });

      await expect(getProject('root')).resolves.toMatchObject({ screenshotCount: 0, openPullRequestCount: 0 });
      await expect(getProject('ui')).resolves.toMatchObject({ screenshotCount: 1, openPullRequestCount: 1 });
    });

    describe('query', () => {
      const other = newCiAuth({ repository: 'immich-app/immich' });

      const searchNames = async (dto: ProjectSearchDto) => {
        const projects = await sut.search(dto);

        return projects.map(({ name }) => name);
      };

      beforeEach(async () => {
        await ctx.buildService.create(auth, main);
        await ctx.buildService.create(auth, { ...main, project: 'root' });
        await ctx.buildService.create(other, { ...main, project: 'web' });
      });

      it.each([
        { query: 'ui', expected: ['ui'] },
        { query: 'ROO', expected: ['root'] },
        { query: 'static-pages', expected: ['root', 'ui'] },
        { query: 'immich-app/immich', expected: ['web'] },
        { query: 'static_pages', expected: [] },
        { query: 'nothing-like-this', expected: [] },
      ])('finds $expected for "$query"', async ({ query, expected }) => {
        await expect(searchNames({ query })).resolves.toEqual(expected);
      });

      it('lists only the projects of the requested repository', async () => {
        await expect(searchNames({ repository: 'immich-app/static-pages' })).resolves.toEqual(['root', 'ui']);
      });

      it('returns the one project asked for by id', async () => {
        const project = await getProject('root');

        await expect(searchNames({ id: project?.id })).resolves.toEqual(['root']);
      });
    });
  });
});
