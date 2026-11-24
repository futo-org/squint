import type { Kysely } from 'kysely';
import type { BuildCreateDto } from 'src/dtos/build.dto.js';
import type { ScreenshotVersionSearchDto } from 'src/dtos/screenshot-version.dto.js';
import { BuildKind, ScreenshotTheme } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { ScreenshotVersionService } from 'src/services/screenshot-version.service.js';
import { type MediumContext, newMediumContext } from 'test/medium.factory.js';
import { getKyselyDB, newCiAuth, newPng, sha256 } from 'test/utils.js';

const DAY = 24 * 60 * 60 * 1000;

const main = { project: 'ui', kind: BuildKind.Main, branch: 'main', commit: 'a'.repeat(40) };
const pullRequest = {
  project: 'ui',
  kind: BuildKind.PullRequest,
  branch: 'feat/x',
  commit: 'b'.repeat(40),
  pullRequestNumber: 7,
};
const mainAt = (commit: string) => ({ ...main, commit: commit.repeat(40) });
const hash = (content: string) => sha256(newPng(content));

describe(ScreenshotVersionService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: ScreenshotVersionService;

  const ci = newCiAuth();

  const publishOn = (date: string, dto: BuildCreateDto, contents: Record<string, string>) => {
    vi.setSystemTime(new Date(date));

    return ctx.publishBuild(ci, dto, contents);
  };

  const describeVersions = async (dto: ScreenshotVersionSearchDto = {}) => {
    const versions = await sut.search(dto);

    return versions.map(({ name, theme, status, commit }) => `${name}@${theme} ${status} ${commit.slice(0, 1)}`);
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.screenshotVersionService;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await db.destroy();
  });

  describe('search', () => {
    it('records every screenshot of the first main build as new', async () => {
      await publishOn('2026-11-16T09:00:00Z', main, { login: 'login-v1', 'login@dark': 'login-dark-v1' });

      await expect(describeVersions()).resolves.toEqual(['login@light new a', 'login@dark new a']);
    });

    it('records only what a later main build changed, newest first', async () => {
      await publishOn('2026-11-16T09:00:00Z', main, { login: 'login-v1', home: 'home-v1', about: 'about-v1' });
      await publishOn('2026-11-17T09:00:00Z', mainAt('c'), {
        login: 'login-v2',
        home: 'home-v1',
        settings: 'settings-v1',
      });

      const versions = await describeVersions();

      expect(versions.slice(0, 3).toSorted()).toEqual([
        'about@light removed c',
        'login@light changed c',
        'settings@light new c',
      ]);
      expect(versions.slice(3).toSorted()).toEqual(['about@light new a', 'home@light new a', 'login@light new a']);
    });

    it('records nothing for a main build without changes', async () => {
      await publishOn('2026-11-16T09:00:00Z', main, { login: 'login-v1' });
      await publishOn('2026-11-17T09:00:00Z', mainAt('c'), { login: 'login-v1' });

      await expect(describeVersions()).resolves.toEqual(['login@light new a']);
    });

    it('records nothing for a pull request build', async () => {
      await publishOn('2026-11-16T09:00:00Z', main, { login: 'login-v1' });
      await publishOn('2026-11-17T09:00:00Z', pullRequest, { login: 'login-v2' });

      await expect(describeVersions()).resolves.toEqual(['login@light new a']);
    });

    it('records nothing while a main build is still publishing', async () => {
      const { id } = await ctx.buildService.create(ci, main);
      const login = { name: 'login', theme: ScreenshotTheme.Light, viewport: 'desktop', width: 1280, height: 720 };
      await ctx.buildService.setScreenshots(ci, id, {
        screenshots: [{ ...login, sha256: await ctx.uploadBlob('login-v1') }],
      });

      await expect(describeVersions()).resolves.toEqual([]);
    });

    it('describes a version with its images, diff and commit', async () => {
      await publishOn('2026-11-16T09:00:00Z', main, { login: 'login-v1' });
      vi.setSystemTime(new Date('2026-11-17T09:00:00Z'));
      const { id } = await ctx.buildService.create(ci, mainAt('c'));
      const login = { name: 'login', theme: ScreenshotTheme.Light, viewport: 'desktop', width: 1280, height: 720 };
      const { screenshots } = await ctx.buildService.setScreenshots(ci, id, {
        screenshots: [{ ...login, sha256: await ctx.uploadBlob('login-v2') }],
      });
      const regions = [{ x: 12, y: 40, width: 96, height: 32 }];
      const diffs = [
        { screenshotId: screenshots[0].id, sha256: await ctx.uploadBlob('login-diff'), ratio: 0.02, regions },
      ];
      await ctx.buildService.complete(ci, id, { diffs });

      const [version] = await sut.search({});

      expect(version).toEqual({
        id: expect.any(String),
        projectId: expect.any(String),
        name: 'login',
        theme: 'light',
        viewport: 'desktop',
        width: 1280,
        height: 720,
        status: 'changed',
        sha256: hash('login-v2'),
        baselineSha256: hash('login-v1'),
        diffSha256: hash('login-diff'),
        diffRatio: 0.02,
        diffRegions: regions,
        commit: 'c'.repeat(40),
        commitUrl: `https://github.com/immich-app/static-pages/commit/${'c'.repeat(40)}`,
        createdAt: new Date('2026-11-17T09:00:00Z'),
      });
    });

    it('filters by project, screen, theme and viewport', async () => {
      await publishOn('2026-11-16T09:00:00Z', main, { login: 'login-v1', 'login@dark': 'login-dark-v1', home: 'h' });
      const rootBuild = await publishOn('2026-11-16T10:00:00Z', { ...main, project: 'root' }, { login: 'root-login' });
      const { projectId } = await ctx.buildService.get(rootBuild);

      await expect(describeVersions({ projectId })).resolves.toEqual(['login@light new a']);
      await expect(describeVersions({ name: 'home' })).resolves.toEqual(['home@light new a']);
      await expect(describeVersions({ name: 'login', theme: ScreenshotTheme.Dark })).resolves.toEqual([
        'login@dark new a',
      ]);
      await expect(describeVersions({ viewport: 'phone' })).resolves.toEqual([]);
    });

    it('keeps a version and its images after its build is deleted', async () => {
      await publishOn('2026-11-16T09:00:00Z', main, { login: 'login-v1' });
      await publishOn('2026-11-17T09:00:00Z', mainAt('c'), { login: 'login-v2' });
      await publishOn('2026-11-18T09:00:00Z', mainAt('d'), { login: 'login-v3' });

      vi.setSystemTime(Date.now() + 31 * DAY);
      await ctx.trashService.empty();

      await expect(ctx.buildService.search({ isTrashed: true })).resolves.toEqual([]);
      await expect(describeVersions()).resolves.toEqual([
        'login@light changed d',
        'login@light changed c',
        'login@light new a',
      ]);
      for (const content of ['login-v1', 'login-v2', 'login-v3']) {
        await expect(ctx.blobService.download(hash(content))).resolves.toMatchObject({ size: expect.any(Number) });
      }
    });
  });
});
