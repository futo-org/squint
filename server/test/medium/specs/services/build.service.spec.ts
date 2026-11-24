import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { ScreenshotDto, ScreenshotResponseDto } from 'src/dtos/build.dto.js';
import { BuildKind, ScreenshotTheme } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { BuildService } from 'src/services/build.service.js';
import { type MediumContext, newMediumContext } from 'test/medium.factory.js';
import { getKyselyDB, newCiAuth, newPng, sha256 } from 'test/utils.js';

const unknownBuildId = '019a8f3e-7b2c-7d4e-9f1a-2b3c4d5e6f70';
const main = { project: 'ui', kind: BuildKind.Main, branch: 'main', commit: 'a'.repeat(40) };
const pullRequest = {
  project: 'ui',
  kind: BuildKind.PullRequest,
  branch: 'feat/x',
  commit: 'b'.repeat(40),
  pullRequestNumber: 7,
};

const newScreenshot = (name: string, content: string, overrides: Partial<ScreenshotDto> = {}): ScreenshotDto => ({
  name,
  theme: ScreenshotTheme.Light,
  viewport: 'desktop',
  width: 1280,
  height: 720,
  sha256: sha256(newPng(content)),
  ...overrides,
});

const summarize = (screenshots: ScreenshotResponseDto[]) =>
  Object.fromEntries(screenshots.map(({ name, status }) => [name, status]));

describe(BuildService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: BuildService;

  const auth = newCiAuth();
  const otherRepository = newCiAuth({ repository: 'immich-app/immich' });
  const pullRequestWorkflow = newCiAuth({
    ref: 'refs/pull/7/merge',
    workflowRef: 'immich-app/static-pages/.github/workflows/squint.yml@refs/pull/7/merge',
  });

  beforeEach(async () => {
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.buildService;
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('create', () => {
    it('tells clients the builds and projects changed', async () => {
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await sut.create(auth, main);

      expect(update).toHaveBeenCalledExactlyOnceWith('/builds', '/projects');
    });

    it('tells clients nothing when the build is refused', async () => {
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await expect(sut.create(pullRequestWorkflow, main)).rejects.toBeInstanceOf(ForbiddenException);

      expect(update).not.toHaveBeenCalled();
    });

    it('creates a build and its project', async () => {
      const build = await sut.create(auth, main);

      expect(build).toEqual({
        id: expect.any(String),
        projectId: expect.any(String),
        kind: 'main',
        branch: 'main',
        commit: 'a'.repeat(40),
        pullRequest: null,
        release: null,
        reviewableCount: 0,
        approvedCount: 0,
        review: null,
        trashedAt: null,
        expiresAt: null,
        status: 'pending',
        baselineBuildId: null,
        createdAt: expect.any(Date),
        completedAt: null,
      });
      await expect(ctx.projectService.search({})).resolves.toEqual([
        {
          id: build.projectId,
          repository: 'immich-app/static-pages',
          name: 'ui',
          createdAt: expect.any(Date),
          screenshotCount: 0,
          openPullRequestCount: 0,
        },
      ]);
    });

    it('adds later builds to the same project', async () => {
      await sut.create(auth, main);

      await sut.create(auth, pullRequest);

      const projects = await ctx.projectService.search({});
      const builds = await sut.search({ projectId: projects[0].id });
      expect(projects).toHaveLength(1);
      expect(builds.map(({ kind, pullRequest }) => ({ kind, pullRequest }))).toEqual([
        {
          kind: 'pull-request',
          pullRequest: {
            number: 7,
            title: null,
            state: 'open',
            url: 'https://github.com/immich-app/static-pages/pull/7',
          },
        },
        { kind: 'main', pullRequest: null },
      ]);
    });

    it('keeps projects apart by repository and name', async () => {
      await sut.create(auth, main);
      await sut.create(auth, { ...main, project: 'root' });

      await sut.create(otherRepository, { ...main, project: 'web' });

      const projects = await ctx.projectService.search({});
      expect(projects.map(({ repository, name }) => `${repository}:${name}`)).toEqual([
        'immich-app/immich:web',
        'immich-app/static-pages:root',
        'immich-app/static-pages:ui',
      ]);
    });

    it('rejects a main build from a workflow that is not on main', async () => {
      await expect(sut.create(pullRequestWorkflow, main)).rejects.toBeInstanceOf(ForbiddenException);

      await expect(ctx.projectService.search({})).resolves.toEqual([]);
    });

    it('accepts a pull request build from a workflow that is not on main', async () => {
      const build = await sut.create(pullRequestWorkflow, pullRequest);

      expect(build).toMatchObject({ kind: 'pull-request', status: 'pending' });
    });
  });

  describe('search', () => {
    it('lists only the builds of the requested project', async () => {
      await sut.create(auth, main);
      const root = await sut.create(auth, { ...main, project: 'root' });

      const builds = await sut.search({ projectId: root.projectId });

      expect(builds).toEqual([expect.objectContaining({ id: root.id, projectId: root.projectId })]);
    });
  });

  describe('get', () => {
    it('returns the build with its screenshots', async () => {
      const id = await ctx.publishBuild(auth, main, { button: 'button-v1' });

      const build = await sut.get(id);

      expect(build).toEqual({
        id,
        projectId: expect.any(String),
        kind: 'main',
        branch: 'main',
        commit: 'a'.repeat(40),
        pullRequest: null,
        release: null,
        reviewableCount: 1,
        approvedCount: 0,
        review: null,
        trashedAt: null,
        expiresAt: null,
        status: 'complete',
        baselineBuildId: null,
        createdAt: expect.any(Date),
        completedAt: expect.any(Date),
        screenshots: [
          {
            id: expect.any(String),
            name: 'button',
            theme: 'light',
            viewport: 'desktop',
            width: 1280,
            height: 720,
            status: 'new',
            sha256: sha256(newPng('button-v1')),
            baselineSha256: null,
            diffSha256: null,
            diffRatio: null,
            diffRegions: null,
            approval: null,
          },
        ],
      });
    });

    it('rejects an unknown build', async () => {
      await sut.create(auth, main);

      await expect(sut.get(unknownBuildId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('setScreenshots', () => {
    it('tells clients the build changed', async () => {
      const { id } = await sut.create(auth, main);
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await sut.setScreenshots(auth, id, { screenshots: [newScreenshot('button', 'button-v1')] });

      expect(update).toHaveBeenCalledExactlyOnceWith(`/builds/${id}`);
    });

    it('marks every screenshot new when the project has no baseline', async () => {
      const { id } = await sut.create(auth, main);
      const screenshots = [newScreenshot('button', 'button-v1'), newScreenshot('alert', 'alert-v1')];

      const result = await sut.setScreenshots(auth, id, { screenshots });

      expect(result.baselineBuildId).toBeNull();
      expect(summarize(result.screenshots)).toEqual({ alert: 'new', button: 'new' });
    });

    it('lists the screenshots that still need uploading', async () => {
      const { id } = await sut.create(auth, main);
      await ctx.uploadBlob('button-v1');
      const screenshots = [newScreenshot('button', 'button-v1'), newScreenshot('alert', 'alert-v1')];

      const result = await sut.setScreenshots(auth, id, { screenshots });

      expect(result.missing).toEqual([sha256(newPng('alert-v1'))]);
    });

    it('compares a pull request against the latest complete main build', async () => {
      const baselineId = await ctx.publishBuild(auth, main, {
        button: 'button-v1',
        alert: 'alert-v1',
        card: 'card-v1',
      });
      const { id } = await sut.create(auth, pullRequest);
      const screenshots = [
        newScreenshot('button', 'button-v2'),
        newScreenshot('alert', 'alert-v1'),
        newScreenshot('input', 'input-v1'),
      ];

      const result = await sut.setScreenshots(auth, id, { screenshots });

      expect(result.baselineBuildId).toBe(baselineId);
      expect(summarize(result.screenshots)).toEqual({
        alert: 'unchanged',
        button: 'changed',
        card: 'removed',
        input: 'new',
      });
      expect(result.screenshots.find(({ name }) => name === 'button')).toMatchObject({
        sha256: sha256(newPng('button-v2')),
        baselineSha256: sha256(newPng('button-v1')),
      });
      expect(result.screenshots.find(({ name }) => name === 'card')).toMatchObject({
        sha256: null,
        baselineSha256: sha256(newPng('card-v1')),
      });
    });

    it('treats themes and viewports as separate screenshots', async () => {
      await ctx.publishBuild(auth, main, { button: 'light', 'button@dark': 'dark' });
      const { id } = await sut.create(auth, pullRequest);
      const screenshots = [
        newScreenshot('button', 'light'),
        newScreenshot('button', 'dark-v2', { theme: ScreenshotTheme.Dark }),
        newScreenshot('button', 'phone', { viewport: 'phone', width: 390, height: 844 }),
      ];

      const result = await sut.setScreenshots(auth, id, { screenshots });

      const statuses = result.screenshots.map(({ viewport, theme, status }) => [`${viewport}/${theme}`, status]);
      expect(Object.fromEntries(statuses)).toEqual({
        'desktop/light': 'unchanged',
        'desktop/dark': 'changed',
        'phone/light': 'new',
      });
    });

    it('does not compare against a main build that is still pending', async () => {
      const pending = await sut.create(auth, main);
      await sut.setScreenshots(auth, pending.id, { screenshots: [newScreenshot('button', 'button-v1')] });
      const { id } = await sut.create(auth, pullRequest);

      const result = await sut.setScreenshots(auth, id, { screenshots: [newScreenshot('button', 'button-v2')] });

      expect(result.baselineBuildId).toBeNull();
      expect(summarize(result.screenshots)).toEqual({ button: 'new' });
    });

    it('compares a main build against the previous main build', async () => {
      const firstId = await ctx.publishBuild(auth, main, { button: 'button-v1' });
      const { id } = await sut.create(auth, { ...main, commit: 'c'.repeat(40) });

      const result = await sut.setScreenshots(auth, id, { screenshots: [newScreenshot('button', 'button-v2')] });

      expect(result.baselineBuildId).toBe(firstId);
      expect(summarize(result.screenshots)).toEqual({ button: 'changed' });
    });

    it('does not compare against another project', async () => {
      await ctx.publishBuild(auth, { ...main, project: 'root' }, { button: 'button-v1' });
      const { id } = await sut.create(auth, pullRequest);

      const result = await sut.setScreenshots(auth, id, { screenshots: [newScreenshot('button', 'button-v2')] });

      expect(result.baselineBuildId).toBeNull();
      expect(summarize(result.screenshots)).toEqual({ button: 'new' });
    });

    it('replaces the screenshots when published again', async () => {
      const { id } = await sut.create(auth, main);
      const screenshots = [newScreenshot('button', 'button-v1'), newScreenshot('alert', 'alert-v1')];
      await sut.setScreenshots(auth, id, { screenshots });

      await sut.setScreenshots(auth, id, { screenshots: [newScreenshot('button', 'button-v2')] });

      const build = await sut.get(id);
      const expected = sha256(newPng('button-v2'));
      expect(build.screenshots).toEqual([expect.objectContaining({ name: 'button', sha256: expected })]);
    });

    it('hides builds of another repository', async () => {
      const { id } = await sut.create(auth, main);

      const result = sut.setScreenshots(otherRepository, id, { screenshots: [newScreenshot('button', 'button-v1')] });

      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      await expect(sut.get(id)).resolves.toMatchObject({ screenshots: [] });
    });

    it('rejects a build that is already complete', async () => {
      const id = await ctx.publishBuild(auth, main, { button: 'button-v1' });

      const result = sut.setScreenshots(auth, id, { screenshots: [] });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(sut.get(id)).resolves.toMatchObject({ screenshots: [expect.objectContaining({ name: 'button' })] });
    });

    it('rejects the same screenshot listed twice', async () => {
      const { id } = await sut.create(auth, main);
      const screenshots = [newScreenshot('button', 'button-v1'), newScreenshot('button', 'button-v2')];

      await expect(sut.setScreenshots(auth, id, { screenshots })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('complete', () => {
    it('tells clients the builds and projects changed', async () => {
      const { id } = await sut.create(auth, main);
      await ctx.uploadBlob('button-v1');
      await sut.setScreenshots(auth, id, { screenshots: [newScreenshot('button', 'button-v1')] });
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await sut.complete(auth, id, { diffs: [] });

      expect(update).toHaveBeenCalledExactlyOnceWith(
        '/builds',
        '/projects',
        '/dashboard',
        '/screens',
        '/screenshot-versions',
      );
    });

    it('completes the build and records the diffs', async () => {
      await ctx.publishBuild(auth, main, { button: 'button-v1' });
      const { id } = await sut.create(auth, pullRequest);
      await ctx.uploadBlob('button-v2');
      const diffSha256 = await ctx.uploadBlob('button-diff');
      const { screenshots } = await sut.setScreenshots(auth, id, {
        screenshots: [newScreenshot('button', 'button-v2')],
      });
      const regions = [
        { x: 12, y: 40, width: 96, height: 32 },
        { x: 300, y: 0, width: 1, height: 1 },
      ];

      const result = await sut.complete(auth, id, {
        diffs: [{ screenshotId: screenshots[0].id, sha256: diffSha256, ratio: 0.0267, regions }],
      });

      const build = await sut.get(id);
      expect(result).toMatchObject({ id, status: 'complete', completedAt: expect.any(Date) });
      expect(build.status).toBe('complete');
      expect(build.screenshots).toEqual([
        expect.objectContaining({
          name: 'button',
          status: 'changed',
          diffSha256,
          diffRatio: 0.0267,
          diffRegions: regions,
        }),
      ]);
    });

    it('rejects a build with screenshots that were never uploaded', async () => {
      const { id } = await sut.create(auth, main);
      await sut.setScreenshots(auth, id, { screenshots: [newScreenshot('button', 'button-v1')] });

      await expect(sut.complete(auth, id, { diffs: [] })).rejects.toBeInstanceOf(BadRequestException);

      await expect(sut.get(id)).resolves.toMatchObject({ status: 'pending' });
    });

    it('rejects a diff that was never uploaded', async () => {
      await ctx.publishBuild(auth, main, { button: 'button-v1' });
      const { id } = await sut.create(auth, pullRequest);
      await ctx.uploadBlob('button-v2');
      const { screenshots } = await sut.setScreenshots(auth, id, {
        screenshots: [newScreenshot('button', 'button-v2')],
      });
      const diff = { screenshotId: screenshots[0].id, sha256: sha256(newPng('button-diff')), ratio: 0.5, regions: [] };

      await expect(sut.complete(auth, id, { diffs: [diff] })).rejects.toBeInstanceOf(BadRequestException);

      await expect(sut.get(id)).resolves.toMatchObject({ status: 'pending' });
    });

    it('rejects a diff for a screenshot that did not change', async () => {
      const { id } = await sut.create(auth, main);
      await ctx.uploadBlob('button-v1');
      const diffSha256 = await ctx.uploadBlob('button-diff');
      const { screenshots } = await sut.setScreenshots(auth, id, {
        screenshots: [newScreenshot('button', 'button-v1')],
      });
      const diff = { screenshotId: screenshots[0].id, sha256: diffSha256, ratio: 0.5, regions: [] };

      await expect(sut.complete(auth, id, { diffs: [diff] })).rejects.toBeInstanceOf(BadRequestException);

      await expect(sut.get(id)).resolves.toMatchObject({ status: 'pending' });
    });

    it('rejects completing a build twice', async () => {
      const id = await ctx.publishBuild(auth, main, { button: 'button-v1' });

      await expect(sut.complete(auth, id, { diffs: [] })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('hides builds of another repository', async () => {
      const { id } = await sut.create(auth, main);

      await expect(sut.complete(otherRepository, id, { diffs: [] })).rejects.toBeInstanceOf(NotFoundException);

      await expect(sut.get(id)).resolves.toMatchObject({ status: 'pending' });
    });
  });
});
