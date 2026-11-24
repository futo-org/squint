import { BuildKind, ScreenshotStatus, ScreenshotTheme, type ScreenshotResponseDto } from '@futo-org/squint-sdk';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { DiffStatus } from '../enum.js';
import { SquintError } from '../errors.js';
import type { ApiRepository } from '../repositories/api.repository.js';
import type { GithubEnv, GithubRepository } from '../repositories/github.repository.js';
import type { OdiffRepository } from '../repositories/odiff.repository.js';
import type { PngRepository } from '../repositories/png.repository.js';
import type { StorageRepository } from '../repositories/storage.repository.js';
import { DiffService } from './diff.service.js';
import { PublishService } from './publish.service.js';

const directory = '/report';
const temp = '/tmp/squint-publish';
const headSha = '1111111111111111111111111111111111111111';
const mergeSha = '2222222222222222222222222222222222222222';
const buildId = '7e0a8a8a-8a8a-4a8a-8a8a-8a8a8a8a8a8a';

const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');

const pushEnv: GithubEnv = {
  eventName: 'push',
  eventPath: '/github/event.json',
  ref: 'refs/heads/main',
  refName: 'main',
  headRef: '',
  sha: mergeSha,
  tokenUrl: 'https://token.actions.example/token?api-version=2.0',
  tokenRequestToken: 'request-token',
};

const newStorage = (files: Record<string, string>): Mocked<StorageRepository> => {
  const disk = new Map(Object.entries(files).map(([path, data]) => [path, Buffer.from(data)]));

  return {
    exists: vi.fn((path: string) => Promise.resolve(disk.has(path))),
    readFile: vi.fn((path: string) => {
      const data = disk.get(path);
      return data ? Promise.resolve(data) : Promise.reject(Object.assign(new Error(path), { code: 'ENOENT' }));
    }),
    writeFile: vi.fn((path: string, data: Uint8Array) => {
      disk.set(path, Buffer.from(data));
      return Promise.resolve();
    }),
    createTempDirectory: vi.fn(() => Promise.resolve(temp)),
    removeDirectory: vi.fn(() => Promise.resolve()),
  } as unknown as Mocked<StorageRepository>;
};

const newManifest = (screenshots: Array<{ name: string; theme?: string; viewport?: string; file: string }>) =>
  JSON.stringify({
    screenshots: screenshots.map(({ name, theme = 'light', viewport = 'desktop', file }) => ({
      name,
      theme,
      viewport,
      file,
    })),
  });

const newScreenshot = (response: Partial<ScreenshotResponseDto>): ScreenshotResponseDto => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'home',
  theme: ScreenshotTheme.Light,
  viewport: 'desktop',
  width: 100,
  height: 50,
  status: ScreenshotStatus.Unchanged,
  sha256: null,
  baselineSha256: null,
  diffSha256: null,
  diffRatio: null,
  diffRegions: null,
  ...response,
});

describe(PublishService.name, () => {
  let api: Mocked<ApiRepository>;
  let github: Mocked<GithubRepository>;
  let odiff: Mocked<OdiffRepository>;
  let png: Mocked<PngRepository>;
  let storage: Mocked<StorageRepository>;

  const newSut = () => new PublishService(api, github, storage, png, new DiffService(odiff, png));

  beforeEach(() => {
    api = {
      connect: vi.fn(),
      createBuild: vi.fn().mockResolvedValue({ id: buildId }),
      setScreenshots: vi.fn().mockResolvedValue({ baselineBuildId: null, screenshots: [], missing: [] }),
      uploadBlob: vi.fn().mockResolvedValue(undefined),
      downloadBlob: vi.fn().mockResolvedValue(new Uint8Array([9])),
      completeBuild: vi.fn().mockResolvedValue({ id: buildId }),
    } as unknown as Mocked<ApiRepository>;
    github = {
      getEnv: vi.fn().mockReturnValue(pushEnv),
      readEvent: vi.fn().mockRejectedValue(new Error('No event file')),
      getIdToken: vi.fn().mockResolvedValue('oidc-token'),
    } as unknown as Mocked<GithubRepository>;
    odiff = { compare: vi.fn() } as unknown as Mocked<OdiffRepository>;
    png = {
      read: vi.fn().mockResolvedValue({ width: 100, height: 50, data: new Uint8Array(100 * 50 * 4) }),
      getSize: vi.fn().mockReturnValue({ width: 100, height: 50 }),
    } as unknown as Mocked<PngRepository>;
    storage = newStorage({
      [join(directory, 'manifest.json')]: newManifest([{ name: 'home', file: 'home.png' }]),
      [join(directory, 'home.png')]: 'home-png',
    });
  });

  describe('publish', () => {
    it('publishes a push as a main build of that commit', async () => {
      await newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      expect(api.createBuild).toHaveBeenCalledWith({
        project: 'web',
        kind: BuildKind.Main,
        branch: 'main',
        commit: mergeSha,
      });
    });

    it.each(['pull_request', 'pull_request_target'])('publishes a %s event as a pull request build', async (event) => {
      github.getEnv.mockReturnValue({
        ...pushEnv,
        eventName: event,
        ref: 'refs/pull/42/merge',
        refName: '42/merge',
        headRef: 'feat/button',
      });
      github.readEvent.mockResolvedValue({ pull_request: { head: { sha: headSha } } });

      await newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      expect(github.readEvent).toHaveBeenCalledWith('/github/event.json');
      expect(api.createBuild).toHaveBeenCalledWith({
        project: 'web',
        kind: BuildKind.PullRequest,
        branch: 'feat/button',
        commit: headSha,
        pullRequestNumber: 42,
      });
    });

    it('publishes a release build when a release is named', async () => {
      github.getEnv.mockReturnValue({ ...pushEnv, ref: 'refs/tags/v1.2.0', refName: 'v1.2.0' });

      await newSut().publish({ directory, project: 'web', release: 'v1.2.0', server: 'https://squint.example/api' });

      expect(api.createBuild).toHaveBeenCalledWith({
        project: 'web',
        kind: BuildKind.Release,
        branch: 'v1.2.0',
        commit: mergeSha,
        release: 'v1.2.0',
      });
    });

    it('authenticates with an OIDC token for the squint audience', async () => {
      await newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      expect(github.getIdToken).toHaveBeenCalledWith(
        'https://token.actions.example/token?api-version=2.0&audience=squint.futo.org',
        'request-token',
      );
      expect(api.connect).toHaveBeenCalledWith('https://squint.example/api', 'oidc-token');
    });

    it('fails without the OIDC environment and explains the missing permission', async () => {
      github.getEnv.mockReturnValue({ ...pushEnv, tokenUrl: undefined, tokenRequestToken: undefined });

      const promise = newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      await expect(promise).rejects.toThrow(SquintError);
      await expect(promise).rejects.toThrow('permissions: id-token: write');
      expect(api.createBuild).not.toHaveBeenCalled();
    });

    it('sends the size and hash of each screenshot', async () => {
      await newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      expect(api.setScreenshots).toHaveBeenCalledWith(buildId, [
        { name: 'home', theme: 'light', viewport: 'desktop', width: 100, height: 50, sha256: sha256('home-png') },
      ]);
    });

    it('uploads only the screenshots the server is missing', async () => {
      storage = newStorage({
        [join(directory, 'manifest.json')]: newManifest([
          { name: 'home', file: 'home.png' },
          { name: 'settings', file: 'settings.png' },
        ]),
        [join(directory, 'home.png')]: 'home-png',
        [join(directory, 'settings.png')]: 'settings-png',
      });
      api.setScreenshots.mockResolvedValue({
        baselineBuildId: null,
        screenshots: [],
        missing: [sha256('settings-png')],
      });

      const result = await newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      expect(api.uploadBlob).toHaveBeenCalledTimes(1);
      expect(api.uploadBlob).toHaveBeenCalledWith(sha256('settings-png'), Buffer.from('settings-png'));
      expect(result.uploaded).toBe(1);
    });

    it('diffs a changed screenshot against its baseline and uploads the mask', async () => {
      api.setScreenshots.mockResolvedValue({
        baselineBuildId: null,
        screenshots: [newScreenshot({ status: ScreenshotStatus.Changed, baselineSha256: 'b'.repeat(64) })],
        missing: [],
      });
      odiff.compare.mockImplementation(async (_baseline, _current, mask) => {
        await storage.writeFile(mask, Buffer.from('mask-png'));
        return { status: DiffStatus.Changed, pixels: 50 };
      });

      await newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      expect(api.downloadBlob).toHaveBeenCalledWith('b'.repeat(64));
      expect(odiff.compare).toHaveBeenCalledWith(
        expect.stringContaining(temp),
        join(directory, 'home.png'),
        expect.stringContaining(temp),
      );
      expect(api.uploadBlob).toHaveBeenCalledWith(sha256('mask-png'), Buffer.from('mask-png'));
      expect(api.completeBuild).toHaveBeenCalledWith(buildId, [
        {
          screenshotId: '00000000-0000-4000-8000-000000000001',
          sha256: sha256('mask-png'),
          ratio: 0.01,
          regions: [],
        },
      ]);
      expect(storage.removeDirectory).toHaveBeenCalledWith(temp);
    });

    it('does not diff screenshots that are not changed', async () => {
      api.setScreenshots.mockResolvedValue({
        baselineBuildId: null,
        screenshots: [
          newScreenshot({ status: ScreenshotStatus.Unchanged, baselineSha256: 'b'.repeat(64) }),
          newScreenshot({ status: ScreenshotStatus.New }),
        ],
        missing: [],
      });

      await newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      expect(api.downloadBlob).not.toHaveBeenCalled();
      expect(odiff.compare).not.toHaveBeenCalled();
      expect(api.completeBuild).toHaveBeenCalledWith(buildId, []);
    });

    it('completes a resized screenshot without a diff', async () => {
      api.setScreenshots.mockResolvedValue({
        baselineBuildId: null,
        screenshots: [newScreenshot({ status: ScreenshotStatus.Changed, baselineSha256: 'b'.repeat(64) })],
        missing: [],
      });
      odiff.compare.mockResolvedValue({ status: DiffStatus.Resized });

      await newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      expect(api.uploadBlob).not.toHaveBeenCalled();
      expect(api.completeBuild).toHaveBeenCalledWith(buildId, []);
    });

    it('fails when the manifest is missing', async () => {
      storage = newStorage({});

      const promise = newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      await expect(promise).rejects.toThrow(new SquintError('Manifest not found: /report/manifest.json'));
    });

    it('fails when a screenshot file is missing', async () => {
      storage = newStorage({
        [join(directory, 'manifest.json')]: newManifest([{ name: 'home', file: 'home.png' }]),
      });

      const promise = newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      await expect(promise).rejects.toThrow(new SquintError('Screenshot not found: home.png'));
      expect(api.createBuild).not.toHaveBeenCalled();
    });

    it('fails when a screenshot is listed twice', async () => {
      storage = newStorage({
        [join(directory, 'manifest.json')]: newManifest([
          { name: 'home', file: 'home.png' },
          { name: 'home', file: 'home-2.png' },
        ]),
        [join(directory, 'home.png')]: 'home-png',
        [join(directory, 'home-2.png')]: 'home-2-png',
      });

      const promise = newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      await expect(promise).rejects.toThrow(new SquintError('Duplicate screenshot: home (light, desktop)'));
      expect(api.createBuild).not.toHaveBeenCalled();
    });

    it('fails when a manifest entry has an unknown theme', async () => {
      storage = newStorage({
        [join(directory, 'manifest.json')]: newManifest([{ name: 'home', theme: 'sepia', file: 'home.png' }]),
        [join(directory, 'home.png')]: 'home-png',
      });

      const promise = newSut().publish({ directory, project: 'web', server: 'https://squint.example/api' });

      await expect(promise).rejects.toThrow(new SquintError('Invalid manifest: /report/manifest.json'));
    });
  });
});
