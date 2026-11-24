import type { Kysely } from 'kysely';
import type { BuildCreateDto, BuildSearchDto } from 'src/dtos/build.dto.js';
import { BuildKind, BuildStatus, PullRequestState, ReviewStatus } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { BuildService } from 'src/services/build.service.js';
import { type MediumContext, newMediumContext } from 'test/medium.factory.js';
import { getKyselyDB, newCiAuth } from 'test/utils.js';

const main = { project: 'ui', kind: BuildKind.Main, branch: 'main', commit: 'a'.repeat(40) };
const newPullRequest = (number: number, branch: string, commit: string): BuildCreateDto => ({
  project: 'ui',
  kind: BuildKind.PullRequest,
  branch,
  commit: commit.repeat(40),
  pullRequestNumber: number,
});
const radius = newPullRequest(7, 'feat/button-radius', 'b');
const border = newPullRequest(8, 'fix/input_border', 'c');
const docs = newPullRequest(19, 'chore/docs-copy', 'd');

describe(BuildService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: BuildService;

  const ci = newCiAuth();

  const publish = (dto: BuildCreateDto, contents: Record<string, string>) => ctx.publishBuild(ci, dto, contents);

  const reportPullRequest = (number: number, title: string, overrides: Record<string, unknown> = {}) =>
    ctx.deliverWebhook('pull_request', {
      action: 'edited',
      repository: { full_name: ci.repository },
      pull_request: { number, title, state: 'open', merged: false, ...overrides },
    });

  const searchBranches = async (dto: BuildSearchDto) => {
    const builds = await sut.search(dto);

    return builds.map(({ branch }) => branch).toSorted();
  };

  const getReview = async (id: string) => {
    const build = await sut.get(id);

    return build.review;
  };

  beforeEach(async () => {
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.buildService;
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('search', () => {
    describe('query', () => {
      beforeEach(async () => {
        await sut.create(ci, main);
        await sut.create(ci, radius);
        await sut.create(ci, border);
        await sut.create(ci, docs);
        await reportPullRequest(7, 'Tighter button radius');
        await reportPullRequest(19, 'Reword the 100% docs');
      });

      it.each([
        { query: 'button', expected: ['feat/button-radius'] },
        { query: 'BUTTON-RAD', expected: ['feat/button-radius'] },
        { query: 'tighter', expected: ['feat/button-radius'] },
        { query: 'bbbbbbbb', expected: ['feat/button-radius'] },
        { query: 'BBBBBBBB', expected: ['feat/button-radius'] },
        { query: '#7', expected: ['feat/button-radius'] },
        { query: '19', expected: ['chore/docs-copy'] },
        { query: 'fix/', expected: ['fix/input_border'] },
        { query: 'input_border', expected: ['fix/input_border'] },
        { query: 'input-border', expected: [] },
        { query: '100%', expected: ['chore/docs-copy'] },
        { query: '%', expected: ['chore/docs-copy'] },
        { query: 'main', expected: ['main'] },
        { query: 'nothing-like-this', expected: [] },
      ])('finds $expected for "$query"', async ({ query, expected }) => {
        await expect(searchBranches({ query })).resolves.toEqual(expected);
      });

      it('does not match a commit in the middle', async () => {
        await sut.create(ci, { ...newPullRequest(20, 'feat/other', 'e'), commit: `${'e'.repeat(36)}abcd` });

        await expect(searchBranches({ query: 'abcd' })).resolves.toEqual([]);
      });

      it('searches inside the requested project only', async () => {
        const { projectId } = await sut.create(ci, { ...radius, project: 'root' });

        const builds = await sut.search({ query: 'button', projectId });

        expect(builds.map(({ projectId }) => projectId)).toEqual([projectId]);
      });
    });

    describe('filters', () => {
      beforeEach(async () => {
        await publish(main, { button: 'button-v1' });
        await publish(radius, { button: 'button-v2' });
        await sut.create(ci, border);
        await sut.create(ci, docs);
        await reportPullRequest(8, 'Input border', { state: 'closed', merged: true });
        await reportPullRequest(19, 'Docs copy', { state: 'closed' });
      });

      it.each([
        { filter: { kind: BuildKind.Main }, expected: ['main'] },
        { filter: { kind: BuildKind.PullRequest }, expected: ['feat/button-radius'] },
        { filter: { status: BuildStatus.Complete }, expected: ['feat/button-radius', 'main'] },
        { filter: { status: BuildStatus.Pending }, expected: [] },
        { filter: { pullRequestState: PullRequestState.Open }, expected: ['feat/button-radius'] },
        { filter: { pullRequestState: PullRequestState.Merged }, expected: [] },
        { filter: { branch: 'main' }, expected: ['main'] },
        { filter: { branch: 'fix' }, expected: [] },
        { filter: { review: ReviewStatus.NeedsReview }, expected: ['feat/button-radius'] },
        { filter: { review: ReviewStatus.Approved }, expected: [] },
        { filter: { kind: BuildKind.Main, query: 'button' }, expected: [] },
        { filter: { isTrashed: true }, expected: ['chore/docs-copy', 'fix/input_border'] },
        { filter: { isTrashed: true, status: BuildStatus.Pending }, expected: ['chore/docs-copy', 'fix/input_border'] },
        { filter: { isTrashed: true, pullRequestState: PullRequestState.Merged }, expected: ['fix/input_border'] },
        { filter: { isTrashed: true, pullRequestState: PullRequestState.Closed }, expected: ['chore/docs-copy'] },
        { filter: { isTrashed: true, kind: BuildKind.PullRequest, query: 'docs' }, expected: ['chore/docs-copy'] },
        { filter: { isTrashed: true, kind: BuildKind.Main }, expected: [] },
      ])('returns $expected for $filter', async ({ filter, expected }) => {
        await expect(searchBranches(filter)).resolves.toEqual(expected);
      });

      it('returns the one build asked for by id', async () => {
        const { id } = await sut.create(ci, newPullRequest(30, 'feat/by-id', 'f'));

        const builds = await sut.search({ id });

        expect(builds.map(({ branch }) => branch)).toEqual(['feat/by-id']);
      });
    });

    describe('review', () => {
      it('needs review when an open pull request has changes nobody approved', async () => {
        await publish(main, { button: 'button-v1', alert: 'alert-v1' });
        const id = await publish(radius, { button: 'button-v2', alert: 'alert-v2' });
        await sut.approve(await ctx.newUser(), id, { name: 'alert' });

        await expect(getReview(id)).resolves.toBe(ReviewStatus.NeedsReview);
      });

      it('is approved once every change is approved', async () => {
        await publish(main, { button: 'button-v1' });
        const id = await publish(radius, { button: 'button-v2' });
        await sut.approve(await ctx.newUser(), id, { name: 'button' });

        await expect(getReview(id)).resolves.toBe(ReviewStatus.Approved);
        await expect(searchBranches({ review: ReviewStatus.Approved })).resolves.toEqual(['feat/button-radius']);
      });

      it('needs review again after the approval is taken back', async () => {
        await publish(main, { button: 'button-v1' });
        const id = await publish(radius, { button: 'button-v2' });
        const approver = await ctx.newUser();
        await sut.approve(approver, id, { name: 'button' });

        await sut.revoke(approver, id, { name: 'button' });

        await expect(getReview(id)).resolves.toBe(ReviewStatus.NeedsReview);
      });

      it('is unchanged when nothing differs from main', async () => {
        await publish(main, { button: 'button-v1' });
        const id = await publish(radius, { button: 'button-v1' });

        await expect(getReview(id)).resolves.toBe(ReviewStatus.Unchanged);
        await expect(searchBranches({ review: ReviewStatus.Unchanged })).resolves.toEqual(['feat/button-radius']);
      });

      it('has no review status while the build is publishing', async () => {
        await publish(main, { button: 'button-v1' });
        const { id } = await sut.create(ci, radius);
        await expect(getReview(id)).resolves.toBeNull();
      });

      it('leaves the review to the newest build of the pull request', async () => {
        await publish(main, { button: 'button-v1' });
        const older = await publish(radius, { button: 'button-v2' });
        const newer = await publish({ ...radius, commit: 'e'.repeat(40) }, { button: 'button-v3' });

        await expect(getReview(older)).resolves.toBeNull();
        await expect(getReview(newer)).resolves.toBe(ReviewStatus.NeedsReview);
      });

      it('keeps the review on the complete build while a newer one is publishing', async () => {
        await publish(main, { button: 'button-v1' });
        const complete = await publish(radius, { button: 'button-v2' });
        await sut.create(ci, { ...radius, commit: 'e'.repeat(40) });

        await expect(getReview(complete)).resolves.toBe(ReviewStatus.NeedsReview);
      });

      it.each([
        { title: 'merged', overrides: { state: 'closed', merged: true } },
        { title: 'closed', overrides: { state: 'closed' } },
      ])('needs no review once the pull request is $title', async ({ overrides }) => {
        await publish(main, { button: 'button-v1' });
        const id = await publish(radius, { button: 'button-v2' });

        await reportPullRequest(7, 'Tighter button radius', overrides);

        await expect(getReview(id)).resolves.toBeNull();
        await expect(searchBranches({ review: ReviewStatus.NeedsReview })).resolves.toEqual([]);
      });

      it('needs no review for changes on main', async () => {
        await publish(main, { button: 'button-v1' });
        const id = await publish({ ...main, commit: 'e'.repeat(40) }, { button: 'button-v2' });

        await expect(getReview(id)).resolves.toBeNull();
      });

      it('judges the same pull request number in another project on its own', async () => {
        await publish(main, { button: 'button-v1' });
        const ui = await publish(radius, { button: 'button-v2' });
        await publish({ ...main, project: 'root' }, { home: 'home-v1' });
        const root = await publish({ ...radius, project: 'root', commit: 'e'.repeat(40) }, { home: 'home-v2' });

        await expect(getReview(ui)).resolves.toBe(ReviewStatus.NeedsReview);
        await expect(getReview(root)).resolves.toBe(ReviewStatus.NeedsReview);
      });
    });
  });
});
