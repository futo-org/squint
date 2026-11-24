import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { BuildCreateDto } from 'src/dtos/build.dto.js';
import { BuildKind, UserRole } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { BuildService } from 'src/services/build.service.js';
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

describe(BuildService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: BuildService;

  const ci = newCiAuth();

  const publish = (dto: BuildCreateDto, contents: Record<string, string>) => ctx.publishBuild(ci, dto, contents);

  const newApprover = () => ctx.newUser({ name: 'Approver', role: UserRole.Approver });

  const newViewer = () => ctx.newUser({ name: 'Viewer', role: UserRole.Viewer });

  const getApprovers = async (buildId: string) => {
    const { screenshots } = await sut.get(buildId);

    return Object.fromEntries(
      screenshots.map(({ name, theme, approval }) => [`${name}@${theme}`, approval?.userName ?? null]),
    );
  };

  beforeEach(async () => {
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.buildService;
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('approve', () => {
    it('tells clients the builds changed', async () => {
      await publish(main, { button: 'button-v1' });
      const buildId = await publish(pullRequest, { button: 'button-v2' });
      const approver = await newApprover();
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await sut.approve(approver, buildId, { name: 'button' });

      expect(update).toHaveBeenCalledExactlyOnceWith('/builds');
    });

    it('tells clients nothing when a viewer is refused', async () => {
      await publish(main, { button: 'button-v1' });
      const buildId = await publish(pullRequest, { button: 'button-v2' });
      const viewer = await newViewer();
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await expect(sut.approve(viewer, buildId, { name: 'button' })).rejects.toBeInstanceOf(ForbiddenException);

      expect(update).not.toHaveBeenCalled();
    });

    it('approves every changed theme of the screen', async () => {
      await publish(main, { 'components/button': 'light-v1', 'components/button@dark': 'dark-v1' });
      const buildId = await publish(pullRequest, {
        'components/button': 'light-v2',
        'components/button@dark': 'dark-v2',
      });
      const approver = await newApprover();

      await sut.approve(approver, buildId, { name: 'components/button' });

      await expect(getApprovers(buildId)).resolves.toEqual({
        'components/button@light': 'Approver',
        'components/button@dark': 'Approver',
      });
    });

    it('leaves unchanged themes and other screens alone', async () => {
      await publish(main, { button: 'light-v1', 'button@dark': 'dark-v1', alert: 'alert-v1' });
      const buildId = await publish(pullRequest, { button: 'light-v2', 'button@dark': 'dark-v1', alert: 'alert-v2' });
      const approver = await newApprover();

      await sut.approve(approver, buildId, { name: 'button' });

      await expect(getApprovers(buildId)).resolves.toEqual({
        'alert@light': null,
        'button@light': 'Approver',
        'button@dark': null,
      });
    });

    it('keeps the approval when the same change is published again', async () => {
      await publish(main, { button: 'light-v1', 'button@dark': 'dark-v1' });
      const firstId = await publish(pullRequest, { button: 'light-v2', 'button@dark': 'dark-v2' });
      const approver = await newApprover();
      await sut.approve(approver, firstId, { name: 'button' });

      const secondId = await publish(
        { ...pullRequest, commit: 'c'.repeat(40) },
        { button: 'light-v2', 'button@dark': 'dark-v3' },
      );

      await expect(getApprovers(secondId)).resolves.toEqual({ 'button@light': 'Approver', 'button@dark': null });
    });

    it.each([
      { status: 'new', name: 'card', expected: { 'card@light': 'Approver', 'button@light': null } },
      { status: 'removed', name: 'button', expected: { 'card@light': null, 'button@light': 'Approver' } },
    ])('approves a $status screen', async ({ name, expected }) => {
      await publish(main, { button: 'button-v1' });
      const buildId = await publish(pullRequest, { card: 'card-v1' });
      const approver = await newApprover();

      await sut.approve(approver, buildId, { name });

      await expect(getApprovers(buildId)).resolves.toEqual(expected);
    });

    it('is safe to approve twice', async () => {
      await publish(main, { button: 'button-v1' });
      const buildId = await publish(pullRequest, { button: 'button-v2' });
      const approver = await newApprover();
      await sut.approve(approver, buildId, { name: 'button' });

      await sut.approve(approver, buildId, { name: 'button' });

      await expect(getApprovers(buildId)).resolves.toEqual({ 'button@light': 'Approver' });
    });

    it('rejects a viewer', async () => {
      await publish(main, { button: 'button-v1' });
      const buildId = await publish(pullRequest, { button: 'button-v2' });
      const viewer = await newViewer();

      const result = sut.approve(viewer, buildId, { name: 'button' });

      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      await expect(getApprovers(buildId)).resolves.toEqual({ 'button@light': null });
    });

    it('rejects a screen with nothing to review', async () => {
      await publish(main, { button: 'button-v1' });
      const buildId = await publish(pullRequest, { button: 'button-v1' });
      const approver = await newApprover();

      const result = sut.approve(approver, buildId, { name: 'button' });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a screen the build does not have', async () => {
      const buildId = await publish(main, { button: 'button-v1' });
      const approver = await newApprover();

      const result = sut.approve(approver, buildId, { name: 'card' });

      await expect(result).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('revoke', () => {
    it('tells clients the builds changed', async () => {
      await publish(main, { button: 'button-v1' });
      const buildId = await publish(pullRequest, { button: 'button-v2' });
      const approver = await newApprover();
      await sut.approve(approver, buildId, { name: 'button' });
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await sut.revoke(approver, buildId, { name: 'button' });

      expect(update).toHaveBeenCalledExactlyOnceWith('/builds');
    });

    it('takes the approval back for every theme of the screen', async () => {
      await publish(main, { button: 'light-v1', 'button@dark': 'dark-v1' });
      const buildId = await publish(pullRequest, { button: 'light-v2', 'button@dark': 'dark-v2' });
      const approver = await newApprover();
      await sut.approve(approver, buildId, { name: 'button' });

      await sut.revoke(approver, buildId, { name: 'button' });

      await expect(getApprovers(buildId)).resolves.toEqual({ 'button@light': null, 'button@dark': null });
    });

    it.each([
      { status: 'new', name: 'card' },
      { status: 'removed', name: 'alert' },
    ])('takes the approval back for a $status screen', async ({ name }) => {
      await publish(main, { button: 'button-v1', alert: 'alert-v1' });
      const buildId = await publish(pullRequest, { button: 'button-v1', card: 'card-v1' });
      const approver = await newApprover();
      await sut.approve(approver, buildId, { name });

      await sut.revoke(approver, buildId, { name });

      await expect(getApprovers(buildId)).resolves.toMatchObject({ [`${name}@light`]: null });
    });

    it('rejects a viewer', async () => {
      await publish(main, { button: 'button-v1' });
      const buildId = await publish(pullRequest, { button: 'button-v2' });
      const approver = await newApprover();
      await sut.approve(approver, buildId, { name: 'button' });
      const viewer = await newViewer();

      const result = sut.revoke(viewer, buildId, { name: 'button' });

      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      await expect(getApprovers(buildId)).resolves.toEqual({ 'button@light': 'Approver' });
    });
  });

  describe('search', () => {
    it('reports how many changed screens of each build are approved', async () => {
      const mainId = await publish(main, {
        button: 'light-v1',
        'button@dark': 'dark-v1',
        alert: 'alert-v1',
        card: 'c',
      });
      const buildId = await publish(pullRequest, {
        button: 'light-v2',
        'button@dark': 'dark-v2',
        alert: 'alert-v2',
        card: 'c',
      });
      const approver = await newApprover();

      await sut.approve(approver, buildId, { name: 'button' });

      const builds = await sut.search({});
      expect(builds.map(({ id, reviewableCount, approvedCount }) => ({ id, reviewableCount, approvedCount }))).toEqual([
        { id: buildId, reviewableCount: 2, approvedCount: 1 },
        { id: mainId, reviewableCount: 3, approvedCount: 0 },
      ]);
    });

    it('does not count a screen with an unapproved theme as approved', async () => {
      await publish(main, { button: 'light-v1', 'button@dark': 'dark-v1' });
      const firstId = await publish(pullRequest, { button: 'light-v2', 'button@dark': 'dark-v2' });
      await sut.approve(await newApprover(), firstId, { name: 'button' });

      const buildId = await publish(pullRequest, { button: 'light-v2', 'button@dark': 'dark-v3' });

      const [build] = await sut.search({ id: buildId });
      expect({ reviewableCount: build.reviewableCount, approvedCount: build.approvedCount }).toEqual({
        reviewableCount: 1,
        approvedCount: 0,
      });
    });
  });
});
