import { ForbiddenException } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { BuildCreateDto } from 'src/dtos/build.dto.js';
import { BuildKind } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { BuildService } from 'src/services/build.service.js';
import { type MediumContext, newMediumContext } from 'test/medium.factory.js';
import { getKyselyDB, newCiAuth } from 'test/utils.js';

const main = { project: 'ui', kind: BuildKind.Main, branch: 'main', commit: 'a'.repeat(40) };
const newRelease = (release: string, commit: string): BuildCreateDto => ({
  project: 'ui',
  kind: BuildKind.Release,
  branch: 'main',
  commit: commit.repeat(40),
  release,
});
const pullRequest = {
  project: 'ui',
  kind: BuildKind.PullRequest,
  branch: 'feat/x',
  commit: 'f'.repeat(40),
  pullRequestNumber: 7,
};

describe(BuildService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: BuildService;

  const ci = newCiAuth();
  const tag = newCiAuth({
    ref: 'refs/tags/v2.3.0',
    workflowRef: 'immich-app/static-pages/.github/workflows/squint.yml@refs/tags/v2.3.0',
  });

  const publish = (auth: typeof ci, dto: BuildCreateDto, contents: Record<string, string>) =>
    ctx.publishBuild(auth, dto, contents);

  const summarize = async (id: string) => {
    const { screenshots } = await sut.get(id);

    return Object.fromEntries(screenshots.map(({ name, status }) => [name, status]));
  };

  const getKept = async () => {
    const builds = await sut.search({});

    return builds.map(({ kind, release, commit }) => `${kind} ${release ?? '-'} ${commit.slice(0, 1)}`).toSorted();
  };

  beforeEach(async () => {
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.buildService;
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('create', () => {
    it('creates a release build from a tag workflow', async () => {
      const build = await sut.create(tag, newRelease('v2.3.0', 'b'));

      expect(build).toMatchObject({ kind: 'release', release: 'v2.3.0', branch: 'main', pullRequest: null });
    });

    it.each([
      { title: 'main', workflowRef: 'immich-app/static-pages/.github/workflows/squint.yml@refs/heads/main' },
      {
        title: 'a pull request',
        workflowRef: 'immich-app/static-pages/.github/workflows/squint.yml@refs/pull/7/merge',
      },
    ])('rejects a release build from a workflow on $title', async ({ workflowRef }) => {
      const result = sut.create(newCiAuth({ workflowRef }), newRelease('v2.3.0', 'b'));

      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      await expect(sut.search({})).resolves.toEqual([]);
    });

    it('rejects a main build from a tag workflow', async () => {
      await expect(sut.create(tag, main)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('setScreenshots', () => {
    it('compares a release with the previous release, not main', async () => {
      await publish(tag, newRelease('v2.2.0', 'b'), { login: 'login-v1', home: 'home-v1' });
      await publish(ci, main, { login: 'login-v2', home: 'home-v2' });

      const id = await publish(tag, newRelease('v2.3.0', 'c'), { login: 'login-v2', home: 'home-v1' });

      await expect(summarize(id)).resolves.toEqual({ home: 'unchanged', login: 'changed' });
    });

    it('marks every screenshot of the first release new', async () => {
      await publish(ci, main, { login: 'login-v1' });

      const id = await publish(tag, newRelease('v2.3.0', 'c'), { login: 'login-v1' });

      await expect(summarize(id)).resolves.toEqual({ login: 'new' });
    });

    it('does not compare main or a pull request with a release', async () => {
      await publish(ci, main, { login: 'login-v1' });
      await publish(tag, newRelease('v2.3.0', 'c'), { login: 'login-v2' });

      const id = await publish(ci, pullRequest, { login: 'login-v1' });

      await expect(summarize(id)).resolves.toEqual({ login: 'unchanged' });
    });
  });

  describe('search', () => {
    it('keeps every release when newer builds complete', async () => {
      await publish(tag, newRelease('v2.2.0', 'b'), { login: 'login-v1' });
      await publish(tag, newRelease('v2.3.0', 'c'), { login: 'login-v2' });
      await publish(ci, main, { login: 'login-v3' });
      await publish(ci, { ...main, commit: 'd'.repeat(40) }, { login: 'login-v4' });

      await expect(getKept()).resolves.toEqual(['main - d', 'release v2.2.0 b', 'release v2.3.0 c']);
    });

    it('keeps only the newest copy of a release published twice', async () => {
      await publish(tag, newRelease('v2.3.0', 'b'), { login: 'login-v1' });

      await publish(tag, newRelease('v2.3.0', 'c'), { login: 'login-v1' });

      await expect(getKept()).resolves.toEqual(['release v2.3.0 c']);
    });

    it('keeps the newest main build when a release completes', async () => {
      await publish(ci, main, { login: 'login-v1' });

      await publish(tag, newRelease('v2.3.0', 'c'), { login: 'login-v1' });

      await expect(getKept()).resolves.toEqual(['main - a', 'release v2.3.0 c']);
    });

    it.each([
      { query: 'v2.3', expected: ['release v2.3.0 c'] },
      { query: 'V2.2.0', expected: ['release v2.2.0 b'] },
    ])('finds $expected for "$query"', async ({ query, expected }) => {
      await sut.create(tag, newRelease('v2.2.0', 'b'));
      await sut.create(tag, newRelease('v2.3.0', 'c'));

      const builds = await sut.search({ query });

      expect(builds.map(({ kind, release, commit }) => `${kind} ${release} ${commit.slice(0, 1)}`)).toEqual(expected);
    });

    it('filters to releases', async () => {
      await sut.create(ci, main);
      await sut.create(tag, newRelease('v2.3.0', 'c'));

      const builds = await sut.search({ kind: BuildKind.Release });

      expect(builds.map(({ release }) => release)).toEqual(['v2.3.0']);
    });
  });

  describe('complete', () => {
    it('adds nothing to the screen history', async () => {
      await publish(ci, main, { login: 'login-v1' });

      await publish(tag, newRelease('v2.3.0', 'c'), { login: 'login-v2' });

      const versions = await ctx.screenshotVersionService.search({});
      expect(versions.map(({ commit }) => commit.slice(0, 1))).toEqual(['a']);
    });
  });
});
