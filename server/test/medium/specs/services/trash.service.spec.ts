import { NotFoundException } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { BuildCreateDto } from 'src/dtos/build.dto.js';
import { BuildKind } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { TrashService } from 'src/services/trash.service.js';
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
const nextCommit = (dto: BuildCreateDto, commit: string) => ({ ...dto, commit: commit.repeat(40) });
const hash = (content: string) => sha256(newPng(content));

describe(TrashService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: TrashService;

  const ci = newCiAuth();

  const publish = (dto: BuildCreateDto, contents: Record<string, string>) => ctx.publishBuild(ci, dto, contents);

  const reportPullRequest = (overrides: Record<string, unknown>) =>
    ctx.deliverWebhook('pull_request', {
      action: 'edited',
      repository: { full_name: ci.repository },
      pull_request: { number: 7, title: 'Tighter button radius', state: 'open', merged: false, ...overrides },
    });

  const getIds = async (isTrashed: boolean) => {
    const builds = await ctx.buildService.search({ isTrashed });

    return builds.map(({ id }) => id).toSorted();
  };

  const isStored = async (content: string) => {
    try {
      await ctx.blobService.download(hash(content));

      return true;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return false;
      }

      throw error;
    }
  };

  const passDays = (days: number) => vi.setSystemTime(Date.now() + days * DAY);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.trashService;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await db.destroy();
  });

  describe('update', () => {
    it('trashes a main build once a newer one completes', async () => {
      const older = await publish(main, { button: 'button-v1' });
      const newer = await publish(nextCommit(main, 'c'), { button: 'button-v2' });

      await expect(getIds(false)).resolves.toEqual([newer]);
      await expect(getIds(true)).resolves.toEqual([older]);
    });

    it('trashes the older build of a pull request once a newer one completes', async () => {
      const baseline = await publish(main, { button: 'button-v1' });
      const older = await publish(pullRequest, { button: 'button-v2' });
      const newer = await publish(nextCommit(pullRequest, 'c'), { button: 'button-v3' });

      await expect(getIds(false)).resolves.toEqual([baseline, newer].toSorted());
      await expect(getIds(true)).resolves.toEqual([older]);
    });

    it('keeps a complete build while a newer one is still publishing', async () => {
      const baseline = await publish(main, { button: 'button-v1' });
      const complete = await publish(pullRequest, { button: 'button-v2' });
      const pending = await ctx.buildService.create(ci, nextCommit(pullRequest, 'c'));

      await sut.update();

      await expect(getIds(false)).resolves.toEqual([baseline, complete, pending.id].toSorted());
      await expect(getIds(true)).resolves.toEqual([]);
    });

    it('keeps the builds of other pull requests and projects', async () => {
      const ui = await publish(main, { button: 'button-v1' });
      const root = await publish({ ...main, project: 'root' }, { home: 'home-v1' });
      const seven = await publish(pullRequest, { button: 'button-v2' });
      const eight = await publish({ ...nextCommit(pullRequest, 'c'), pullRequestNumber: 8 }, { button: 'button-v3' });
      const rootSeven = await publish({ ...nextCommit(pullRequest, 'd'), project: 'root' }, { home: 'home-v2' });

      await sut.update();

      await expect(getIds(false)).resolves.toEqual([ui, root, seven, eight, rootSeven].toSorted());
    });

    it.each([
      { title: 'merged', overrides: { state: 'closed', merged: true } },
      { title: 'closed', overrides: { state: 'closed' } },
    ])('trashes the builds of a $title pull request', async ({ overrides }) => {
      const baseline = await publish(main, { button: 'button-v1' });
      const build = await publish(pullRequest, { button: 'button-v2' });

      await reportPullRequest(overrides);

      await expect(getIds(false)).resolves.toEqual([baseline]);
      await expect(getIds(true)).resolves.toEqual([build]);
    });

    it('keeps a build when the same pull request number closes in another repository', async () => {
      const other = newCiAuth({ repository: 'immich-app/immich' });
      const baseline = await publish(main, { button: 'button-v1' });
      const build = await publish(pullRequest, { button: 'button-v2' });
      const elsewhere = await ctx.buildService.create(other, { ...pullRequest, project: 'web' });

      await ctx.deliverWebhook('pull_request', {
        action: 'closed',
        repository: { full_name: other.repository },
        pull_request: { number: 7, title: 'Unrelated', state: 'closed', merged: true },
      });

      await expect(getIds(false)).resolves.toEqual([baseline, build].toSorted());
      await expect(getIds(true)).resolves.toEqual([elsewhere.id]);
    });

    it('brings back only the newest build when a pull request is reopened', async () => {
      const baseline = await publish(main, { button: 'button-v1' });
      const older = await publish(pullRequest, { button: 'button-v2' });
      const newer = await publish(nextCommit(pullRequest, 'c'), { button: 'button-v3' });
      await reportPullRequest({ state: 'closed' });

      await reportPullRequest({ state: 'open' });

      await expect(getIds(false)).resolves.toEqual([baseline, newer].toSorted());
      await expect(getIds(true)).resolves.toEqual([older]);
    });

    it('says when a trashed build will be deleted', async () => {
      vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
      const older = await publish(main, { button: 'button-v1' });
      await publish(nextCommit(main, 'c'), { button: 'button-v2' });

      const [build] = await ctx.buildService.search({ isTrashed: true });

      expect(build).toMatchObject({
        id: older,
        trashedAt: new Date('2026-11-18T10:00:00Z'),
        expiresAt: new Date('2026-12-18T10:00:00Z'),
      });
    });

    it('has no deletion date on a build that is kept', async () => {
      const id = await publish(main, { button: 'button-v1' });

      await expect(ctx.buildService.get(id)).resolves.toMatchObject({ trashedAt: null, expiresAt: null });
    });

    it('still opens a trashed build', async () => {
      const older = await publish(main, { button: 'button-v1' });
      await publish(nextCommit(main, 'c'), { button: 'button-v2' });

      await expect(ctx.buildService.get(older)).resolves.toMatchObject({ id: older });
    });

    it('tells clients the builds changed only when something moved', async () => {
      await publish(main, { button: 'button-v1' });
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await sut.update();

      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('empty', () => {
    it('deletes a build that has been in the trash for 30 days', async () => {
      const older = await publish(main, { button: 'button-v1' });
      const newer = await publish(nextCommit(main, 'c'), { button: 'button-v2' });

      passDays(31);
      await sut.empty();

      await expect(getIds(true)).resolves.toEqual([]);
      await expect(getIds(false)).resolves.toEqual([newer]);
      await expect(ctx.buildService.get(older)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('keeps a build that has been in the trash for 29 days', async () => {
      const older = await publish(main, { button: 'button-v1' });
      await publish(nextCommit(main, 'c'), { button: 'button-v2' });

      passDays(29);
      await sut.empty();

      await expect(getIds(true)).resolves.toEqual([older]);
      await expect(isStored('button-v1')).resolves.toBe(true);
    });

    it('deletes the screenshots only a deleted pull request build used', async () => {
      await publish(main, { button: 'button-v1', alert: 'alert-v1' });
      await publish(pullRequest, { button: 'button-pr-1', alert: 'alert-v1' });
      await publish(nextCommit(pullRequest, 'c'), { button: 'button-pr-2', alert: 'alert-v1' });

      passDays(31);
      await sut.empty();

      await expect(isStored('button-pr-1')).resolves.toBe(false);
      await expect(isStored('button-pr-2')).resolves.toBe(true);
      await expect(isStored('button-v1')).resolves.toBe(true);
      await expect(isStored('alert-v1')).resolves.toBe(true);
    });

    it('keeps every screenshot that was on main', async () => {
      await publish(main, { button: 'button-v1' });
      await publish(nextCommit(main, 'c'), { button: 'button-v2' });
      await publish(nextCommit(main, 'd'), { button: 'button-v3' });

      passDays(31);
      await sut.empty();

      await expect(getIds(true)).resolves.toEqual([]);
      await expect(isStored('button-v1')).resolves.toBe(true);
      await expect(isStored('button-v2')).resolves.toBe(true);
      await expect(isStored('button-v3')).resolves.toBe(true);
    });

    it('keeps the previous screenshot the newest main build changed', async () => {
      await publish(main, { button: 'button-v1' });
      await publish(nextCommit(main, 'c'), { button: 'button-v2' });

      passDays(31);
      await sut.empty();

      await expect(isStored('button-v1')).resolves.toBe(true);
    });

    it('keeps the baseline an open pull request is compared against', async () => {
      await publish(main, { button: 'button-v1' });
      const review = await publish(pullRequest, { button: 'button-v2' });
      await publish(nextCommit(main, 'c'), { button: 'button-v3' });

      passDays(31);
      await sut.empty();

      const { screenshots } = await ctx.buildService.get(review);
      expect(screenshots).toEqual([expect.objectContaining({ baselineSha256: hash('button-v1') })]);
      await expect(isStored('button-v1')).resolves.toBe(true);
      await expect(isStored('button-v2')).resolves.toBe(true);
    });

    it('deletes the diff of a deleted build and keeps the diff of a kept one', async () => {
      const publishWithDiff = async (dto: BuildCreateDto, content: string, diff: string) => {
        const { id } = await ctx.buildService.create(ci, dto);
        const screenshot = { name: 'button', theme: 'light', viewport: 'desktop', width: 1280, height: 720 } as const;
        const { screenshots } = await ctx.buildService.setScreenshots(ci, id, {
          screenshots: [{ ...screenshot, theme: screenshot.theme as never, sha256: await ctx.uploadBlob(content) }],
        });
        const diffs = [
          { screenshotId: screenshots[0].id, sha256: await ctx.uploadBlob(diff), ratio: 0.1, regions: [] },
        ];
        await ctx.buildService.complete(ci, id, { diffs });
      };
      await publish(main, { button: 'button-v1' });
      await publishWithDiff(pullRequest, 'button-v2', 'diff-v2');
      await publishWithDiff(nextCommit(pullRequest, 'c'), 'button-v3', 'diff-v3');

      passDays(31);
      await sut.empty();

      await expect(isStored('diff-v2')).resolves.toBe(false);
      await expect(isStored('diff-v3')).resolves.toBe(true);
    });

    it('keeps a build that left the trash before the 30 days passed', async () => {
      await publish(main, { button: 'button-v1' });
      const build = await publish(pullRequest, { button: 'button-v2' });
      await reportPullRequest({ state: 'closed' });
      passDays(20);
      await reportPullRequest({ state: 'open' });

      passDays(20);
      await sut.empty();

      await expect(ctx.buildService.get(build)).resolves.toMatchObject({ id: build, trashedAt: null });
      await expect(isStored('button-v2')).resolves.toBe(true);
    });

    it('counts the 30 days from the last time a build was trashed', async () => {
      await publish(main, { button: 'button-v1' });
      const build = await publish(pullRequest, { button: 'button-v2' });
      await reportPullRequest({ state: 'closed' });
      passDays(20);
      await reportPullRequest({ state: 'open' });
      await reportPullRequest({ state: 'closed' });

      passDays(20);
      await sut.empty();

      await expect(getIds(true)).resolves.toEqual([build]);
    });

    it('leaves a screenshot alone that was uploaded a moment ago', async () => {
      await ctx.uploadBlob('not-referenced-yet');

      await sut.empty();

      await expect(isStored('not-referenced-yet')).resolves.toBe(true);
    });

    it('deletes an uploaded screenshot no build ever used after a day', async () => {
      await ctx.uploadBlob('never-referenced');

      passDays(2);
      await sut.empty();

      await expect(isStored('never-referenced')).resolves.toBe(false);
    });

    it('stores a deleted screenshot again when it is published later', async () => {
      await publish(main, { button: 'button-v1' });
      await publish(pullRequest, { button: 'button-pr-1' });
      await publish(nextCommit(pullRequest, 'c'), { button: 'button-pr-2' });
      passDays(31);
      await sut.empty();
      await expect(isStored('button-pr-1')).resolves.toBe(false);

      const build = await publish(nextCommit(pullRequest, 'd'), { button: 'button-pr-1' });

      await expect(ctx.buildService.get(build)).resolves.toMatchObject({ status: 'complete' });
      await expect(isStored('button-pr-1')).resolves.toBe(true);
    });

    it('can store a screenshot again after the storage failed to delete it', async () => {
      await publish(main, { button: 'button-v1' });
      await publish(pullRequest, { button: 'button-pr-1' });
      await publish(nextCommit(pullRequest, 'c'), { button: 'button-pr-2' });
      passDays(31);
      const remove = vi.spyOn(ctx.storageRepository, 'delete').mockRejectedValueOnce(new Error('storage is down'));

      await sut.empty();
      const build = await publish(nextCommit(pullRequest, 'd'), { button: 'button-pr-1' });

      expect(remove).toHaveBeenCalledExactlyOnceWith([expect.stringContaining(hash('button-pr-1'))]);
      await expect(ctx.buildService.get(build)).resolves.toMatchObject({ status: 'complete' });
      await expect(isStored('button-pr-1')).resolves.toBe(true);
    });

    it('tells clients the builds changed after deleting some', async () => {
      await publish(main, { button: 'button-v1' });
      await publish(nextCommit(main, 'c'), { button: 'button-v2' });
      passDays(31);
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await sut.empty();

      expect(update).toHaveBeenCalledExactlyOnceWith('/builds');
    });

    it('tells clients nothing when the trash had nothing to delete', async () => {
      await publish(main, { button: 'button-v1' });
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await sut.empty();

      expect(update).not.toHaveBeenCalled();
    });
  });
});
