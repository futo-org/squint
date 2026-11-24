import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { BuildKind } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { GithubService } from 'src/services/github.service.js';
import { type MediumContext, newMediumContext } from 'test/medium.factory.js';
import { getKyselyDB, newCiAuth, newEnv } from 'test/utils.js';

const pullRequest = {
  project: 'ui',
  kind: BuildKind.PullRequest,
  branch: 'feat/x',
  commit: 'b'.repeat(40),
  pullRequestNumber: 7,
};

const newPullRequestEvent = (
  action: string,
  overrides: Record<string, unknown> = {},
  repository = 'immich-app/static-pages',
) => ({
  action,
  repository: { full_name: repository },
  pull_request: { number: 7, title: 'Tighter button radius', state: 'open', merged: false, ...overrides },
});

describe(GithubService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;

  const auth = newCiAuth();

  const publish = async () => {
    const { id } = await ctx.buildService.create(auth, pullRequest);

    return id;
  };

  const getPullRequest = async (buildId: string) => {
    const build = await ctx.buildService.get(buildId);

    return build.pullRequest;
  };

  beforeEach(async () => {
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('handleWebhook', () => {
    it('tells clients the builds and projects changed', async () => {
      await publish();
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await ctx.deliverWebhook('pull_request', newPullRequestEvent('closed', { state: 'closed', merged: true }));

      expect(update).toHaveBeenCalledExactlyOnceWith('/builds', '/projects');
    });

    it('tells clients nothing for an event it does not use', async () => {
      const update = vi.spyOn(ctx.websocketRepository, 'update');

      await ctx.deliverWebhook('ping', { zen: 'Keep it logically awesome.' });

      expect(update).not.toHaveBeenCalled();
    });

    it('shows a pull request as open before GitHub reports on it', async () => {
      const buildId = await publish();

      await expect(getPullRequest(buildId)).resolves.toEqual({
        number: 7,
        title: null,
        state: 'open',
        url: 'https://github.com/immich-app/static-pages/pull/7',
      });
    });

    it('shows the title GitHub reports', async () => {
      const buildId = await publish();

      await ctx.deliverWebhook('pull_request', newPullRequestEvent('opened'));

      await expect(getPullRequest(buildId)).resolves.toMatchObject({ title: 'Tighter button radius', state: 'open' });
    });

    it('keeps what GitHub reported when the build arrives later', async () => {
      await ctx.deliverWebhook('pull_request', newPullRequestEvent('opened'));

      const buildId = await publish();

      await expect(getPullRequest(buildId)).resolves.toMatchObject({ title: 'Tighter button radius', state: 'open' });
    });

    it('marks a merged pull request as merged', async () => {
      const buildId = await publish();

      await ctx.deliverWebhook('pull_request', newPullRequestEvent('closed', { state: 'closed', merged: true }));

      await expect(getPullRequest(buildId)).resolves.toMatchObject({ state: 'merged' });
    });

    it('marks a pull request closed without merging as closed', async () => {
      const buildId = await publish();

      await ctx.deliverWebhook('pull_request', newPullRequestEvent('closed', { state: 'closed', merged: false }));

      await expect(getPullRequest(buildId)).resolves.toMatchObject({ state: 'closed' });
    });

    it('reopens a pull request', async () => {
      const buildId = await publish();
      await ctx.deliverWebhook('pull_request', newPullRequestEvent('closed', { state: 'closed' }));

      await ctx.deliverWebhook('pull_request', newPullRequestEvent('reopened'));

      await expect(getPullRequest(buildId)).resolves.toMatchObject({ state: 'open' });
    });

    it('updates the title when it is edited', async () => {
      const buildId = await publish();
      await ctx.deliverWebhook('pull_request', newPullRequestEvent('opened'));

      await ctx.deliverWebhook('pull_request', newPullRequestEvent('edited', { title: 'Rounder buttons' }));

      await expect(getPullRequest(buildId)).resolves.toMatchObject({ title: 'Rounder buttons' });
    });

    it('keeps the same number in another repository apart', async () => {
      const buildId = await publish();
      const merged = newPullRequestEvent('closed', { state: 'closed', merged: true }, 'immich-app/immich');

      await ctx.deliverWebhook('pull_request', merged);

      await expect(getPullRequest(buildId)).resolves.toMatchObject({ state: 'open' });
    });

    it('answers a ping', async () => {
      const result = ctx.deliverWebhook('ping', { zen: 'Keep it logically awesome.' });

      await expect(result).resolves.toBeUndefined();
    });

    it('ignores events it does not use', async () => {
      const buildId = await publish();
      const merged = newPullRequestEvent('submitted', { state: 'closed', merged: true });

      const result = ctx.deliverWebhook('pull_request_review', merged);

      await expect(result).resolves.toBeUndefined();
      await expect(getPullRequest(buildId)).resolves.toMatchObject({ state: 'open' });
    });

    it('rejects a delivery signed with another secret', async () => {
      const buildId = await publish();
      const closed = newPullRequestEvent('closed', { state: 'closed' });

      const result = ctx.deliverWebhook('pull_request', closed, { secret: 'another-secret' });

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(getPullRequest(buildId)).resolves.toMatchObject({ state: 'open' });
    });

    it.each(['', 'sha256=', 'sha256=zz', 'sha1=abc'])('rejects the signature "%s"', async (signature) => {
      const result = ctx.deliverWebhook('ping', {}, { signature });

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects every delivery when the webhook secret is empty', async () => {
      ctx = await newMediumContext(db, { github: { ...newEnv().github, webhookSecret: '' } });

      const result = ctx.deliverWebhook('ping', {}, { secret: '' });

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a pull request event without a pull request', async () => {
      const payload = { action: 'opened', repository: { full_name: 'a/b' } };

      const result = ctx.deliverWebhook('pull_request', payload);

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toMatchObject({ message: 'Validation failed' });
    });
  });
});
