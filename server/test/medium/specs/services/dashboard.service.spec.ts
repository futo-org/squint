import type { Kysely } from 'kysely';
import type { BuildCreateDto } from 'src/dtos/build.dto.js';
import { BuildKind } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { DashboardService } from 'src/services/dashboard.service.js';
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

describe(DashboardService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: DashboardService;

  const ci = newCiAuth();

  const publishOn = async (date: string, dto: BuildCreateDto, contents: Record<string, string>) => {
    vi.setSystemTime(new Date(date));
    const id = await ctx.publishBuild(ci, dto, contents);
    const { projectId } = await ctx.buildService.get(id);

    return projectId;
  };

  const getHistory = async () => {
    const { history } = await sut.get();

    return history.map(({ date, screenshotCount }) => ({ date, screenshotCount }));
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.dashboardService;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await db.destroy();
  });

  describe('get', () => {
    it('reports the screenshots on main for each day', async () => {
      await publishOn('2026-11-16T09:00:00Z', main, { button: 'button-v1' });
      await publishOn('2026-11-17T09:00:00Z', main, { button: 'button-v1', alert: 'alert-v1' });
      await publishOn('2026-11-18T09:00:00Z', main, { button: 'button-v1', alert: 'alert-v1', card: 'card-v1' });

      await expect(getHistory()).resolves.toEqual([
        { date: '2026-11-16', screenshotCount: 1 },
        { date: '2026-11-17', screenshotCount: 2 },
        { date: '2026-11-18', screenshotCount: 3 },
      ]);
    });

    it('reports a day once however many builds it had', async () => {
      await publishOn('2026-11-18T09:00:00Z', main, { button: 'button-v1' });
      await publishOn('2026-11-18T15:00:00Z', main, { button: 'button-v1', alert: 'alert-v1' });

      await expect(getHistory()).resolves.toEqual([{ date: '2026-11-18', screenshotCount: 2 }]);
    });

    it('splits the days at midnight UTC', async () => {
      await publishOn('2026-11-17T23:59:59Z', main, { button: 'button-v1' });
      await publishOn('2026-11-18T00:00:00Z', main, { button: 'button-v1', alert: 'alert-v1' });

      await expect(getHistory()).resolves.toEqual([
        { date: '2026-11-17', screenshotCount: 1 },
        { date: '2026-11-18', screenshotCount: 2 },
      ]);
    });

    it('does not count a screenshot the build removed', async () => {
      await publishOn('2026-11-17T09:00:00Z', main, { button: 'button-v1', alert: 'alert-v1' });
      await publishOn('2026-11-18T09:00:00Z', main, { button: 'button-v1' });

      await expect(getHistory()).resolves.toEqual([
        { date: '2026-11-17', screenshotCount: 2 },
        { date: '2026-11-18', screenshotCount: 1 },
      ]);
    });

    it('leaves out pull request builds and builds that are still publishing', async () => {
      await publishOn('2026-11-17T09:00:00Z', main, { button: 'button-v1' });
      await publishOn('2026-11-18T09:00:00Z', pullRequest, { button: 'button-v2', alert: 'alert-v1' });
      vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
      await ctx.buildService.create(ci, { ...main, commit: 'c'.repeat(40) });

      await expect(getHistory()).resolves.toEqual([{ date: '2026-11-17', screenshotCount: 1 }]);
    });

    it('keeps the history after the builds are deleted', async () => {
      await publishOn('2026-11-16T09:00:00Z', main, { button: 'button-v1' });
      await publishOn('2026-11-17T09:00:00Z', main, { button: 'button-v1', alert: 'alert-v1' });
      await publishOn('2026-11-18T09:00:00Z', main, { button: 'button-v1', alert: 'alert-v1', card: 'card-v1' });

      vi.setSystemTime(new Date('2026-12-25T09:00:00Z'));
      await ctx.trashService.empty();

      await expect(ctx.buildService.search({ isTrashed: true })).resolves.toEqual([]);
      await expect(getHistory()).resolves.toEqual([
        { date: '2026-11-16', screenshotCount: 1 },
        { date: '2026-11-17', screenshotCount: 2 },
        { date: '2026-11-18', screenshotCount: 3 },
      ]);
    });

    it('starts with the count from before the last 90 days', async () => {
      await publishOn('2026-08-01T09:00:00Z', main, { button: 'button-v1' });
      await publishOn('2026-08-25T12:00:00Z', main, { button: 'button-v1', alert: 'alert-v1' });

      vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));

      await expect(getHistory()).resolves.toEqual([
        { date: '2026-08-20', screenshotCount: 1 },
        { date: '2026-08-25', screenshotCount: 2 },
      ]);
    });

    it('still reports a project that has not changed in 90 days', async () => {
      await publishOn('2026-06-01T09:00:00Z', main, { button: 'button-v1', alert: 'alert-v1' });

      vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));

      await expect(getHistory()).resolves.toEqual([{ date: '2026-08-20', screenshotCount: 2 }]);
    });

    it('keeps each project on its own', async () => {
      const ui = await publishOn('2026-11-18T09:00:00Z', main, { button: 'button-v1' });
      const root = await publishOn('2026-11-18T10:00:00Z', { ...main, project: 'root' }, { home: 'h', about: 'a' });

      const { history } = await sut.get();

      expect(history).toHaveLength(2);
      expect(history).toEqual(
        expect.arrayContaining([
          { projectId: ui, date: '2026-11-18', screenshotCount: 1 },
          { projectId: root, date: '2026-11-18', screenshotCount: 2 },
        ]),
      );
    });
  });
});
