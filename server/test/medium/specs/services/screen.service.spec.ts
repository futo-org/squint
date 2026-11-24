import type { Kysely } from 'kysely';
import type { BuildCreateDto } from 'src/dtos/build.dto.js';
import { BuildKind } from 'src/enum.js';
import type { DB } from 'src/schema/index.js';
import { ScreenService } from 'src/services/screen.service.js';
import { type MediumContext, newMediumContext } from 'test/medium.factory.js';
import { getKyselyDB, newCiAuth } from 'test/utils.js';

const main = { project: 'ui', kind: BuildKind.Main, branch: 'main', commit: 'a'.repeat(40) };

describe(ScreenService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: ScreenService;

  const ci = newCiAuth();

  const publishOn = (date: string, dto: BuildCreateDto, contents: Record<string, string>) => {
    vi.setSystemTime(new Date(date));

    return ctx.publishBuild(ci, dto, contents);
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.screenService;
    await publishOn('2026-11-16T09:00:00Z', main, {
      'auth/login': 'login-v1',
      'auth/login@dark': 'login-dark-v1',
      home: 'home-v1',
    });
    await publishOn(
      '2026-11-17T09:00:00Z',
      { ...main, commit: 'c'.repeat(40) },
      {
        'auth/login': 'login-v2',
        'auth/login@dark': 'login-dark-v1',
        home: 'home-v1',
      },
    );
  });

  afterEach(async () => {
    vi.useRealTimers();
    await db.destroy();
  });

  describe('search', () => {
    it('lists each screen with its versions and last change', async () => {
      const screens = await sut.search({});

      expect(screens).toEqual([
        {
          projectId: expect.any(String),
          name: 'auth/login',
          versionCount: 2,
          updatedAt: new Date('2026-11-17T09:00:00Z'),
        },
        { projectId: expect.any(String), name: 'home', versionCount: 1, updatedAt: new Date('2026-11-16T09:00:00Z') },
      ]);
    });

    it.each([
      { query: 'login', expected: ['auth/login'] },
      { query: 'AUTH/', expected: ['auth/login'] },
      { query: 'hom', expected: ['home'] },
      { query: 'settings', expected: [] },
    ])('finds $expected for "$query"', async ({ query, expected }) => {
      const screens = await sut.search({ query });

      expect(screens.map(({ name }) => name)).toEqual(expected);
    });

    it('lists only the screens of the requested project', async () => {
      const build = await publishOn('2026-11-18T09:00:00Z', { ...main, project: 'root' }, { landing: 'landing-v1' });
      const { projectId } = await ctx.buildService.get(build);

      const screens = await sut.search({ projectId });

      expect(screens.map(({ name }) => name)).toEqual(['landing']);
    });
  });
});
