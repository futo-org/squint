import type { Kysely } from 'kysely';
import { BuildKind, ScreenshotStatus, ScreenshotTheme } from 'src/enum.js';
import { ScreenshotRepository } from 'src/repositories/screenshot.repository.js';
import type { DB } from 'src/schema/index.js';
import { type MediumContext, newMediumContext } from 'test/medium.factory.js';
import { getKyselyDB, newCiAuth } from 'test/utils.js';

describe(ScreenshotRepository.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: ScreenshotRepository;
  let buildId: string;

  const newScreenshot = (name: string, theme = ScreenshotTheme.Light, viewport = 'desktop') => ({
    buildId,
    name,
    theme,
    viewport,
    width: 1280,
    height: 720,
    status: ScreenshotStatus.New,
    sha256: 'a'.repeat(64),
    baselineSha256: null,
    diffSha256: null,
    diffRatio: null,
    diffRegions: null,
  });

  beforeEach(async () => {
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.screenshotRepository;
    const build = { project: 'ui', kind: BuildKind.Main, branch: 'main', commit: 'a'.repeat(40) };
    ({ id: buildId } = await ctx.buildService.create(newCiAuth(), build));
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('replaceByBuildId', () => {
    it('stores more screenshots than fit in one insert', async () => {
      const screenshots = Array.from({ length: 2500 }, (_, index) => newScreenshot(`screen-${index}`));

      const created = await sut.replaceByBuildId(buildId, screenshots);

      expect(created).toHaveLength(2500);
      expect(new Set(created.map(({ id }) => id)).size).toBe(2500);
      await expect(sut.getByBuildId(buildId)).resolves.toHaveLength(2500);
    });

    it('removes the screenshots it replaces', async () => {
      await sut.replaceByBuildId(buildId, [newScreenshot('button'), newScreenshot('alert')]);

      await sut.replaceByBuildId(buildId, [newScreenshot('card')]);

      const screenshots = await sut.getByBuildId(buildId);
      expect(screenshots.map(({ name }) => name)).toEqual(['card']);
    });

    it('keeps the old screenshots when the new ones are refused', async () => {
      await sut.replaceByBuildId(buildId, [newScreenshot('button')]);

      await expect(sut.replaceByBuildId(buildId, [newScreenshot('card'), newScreenshot('card')])).rejects.toThrow();

      const screenshots = await sut.getByBuildId(buildId);
      expect(screenshots.map(({ name }) => name)).toEqual(['button']);
    });
  });

  describe('getByBuildId', () => {
    it('orders by name, then viewport, then light before dark', async () => {
      await sut.replaceByBuildId(buildId, [
        newScreenshot('button', ScreenshotTheme.Dark, 'phone'),
        newScreenshot('button', ScreenshotTheme.Dark, 'desktop'),
        newScreenshot('alert', ScreenshotTheme.Light, 'phone'),
        newScreenshot('button', ScreenshotTheme.Light, 'desktop'),
      ]);

      const screenshots = await sut.getByBuildId(buildId);

      expect(screenshots.map(({ name, viewport, theme }) => `${name} ${viewport} ${theme}`)).toEqual([
        'alert phone light',
        'button desktop light',
        'button desktop dark',
        'button phone dark',
      ]);
    });
  });
});
