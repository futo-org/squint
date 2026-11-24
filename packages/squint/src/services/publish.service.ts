import {
  BuildKind,
  ScreenshotStatus,
  type BuildCreateDto,
  type DiffDto,
  type ScreenshotResponseDto,
} from '@futo-org/squint-sdk';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Constants } from '../constants.js';
import { DiffStatus } from '../enum.js';
import { SquintError } from '../errors.js';
import { requireUniqueScreenshots, type Manifest, type ManifestEntry } from '../manifest.js';
import type { ApiRepository, Screenshot } from '../repositories/api.repository.js';
import type { GithubEnv, GithubRepository } from '../repositories/github.repository.js';
import type { PngRepository } from '../repositories/png.repository.js';
import type { StorageRepository } from '../repositories/storage.repository.js';
import type { DiffService } from './diff.service.js';

export type PublishOptions = { directory: string; project: string; release?: string; server: string };

type LocalScreenshot = { screenshot: Screenshot; path: string };

export class PublishService {
  constructor(
    private apiRepository: ApiRepository,
    private githubRepository: GithubRepository,
    private storageRepository: StorageRepository,
    private pngRepository: PngRepository,
    private diffService: DiffService,
  ) {}

  async publish({ directory, project, release, server }: PublishOptions) {
    const screenshots = await this.getScreenshots(directory);
    const env = this.githubRepository.getEnv();
    const source = await this.getSource(env, release);
    const token = await this.getToken(env);

    this.apiRepository.connect(server, token);
    const { id } = await this.apiRepository.createBuild({ project, ...source });
    const result = await this.apiRepository.setScreenshots(
      id,
      screenshots.map(({ screenshot }) => screenshot),
    );
    await this.uploadMissing(screenshots, result.missing);
    const diffs = await this.getDiffs(screenshots, result.screenshots);
    const build = await this.apiRepository.completeBuild(id, diffs);

    return {
      build,
      counts: getCounts(result.screenshots),
      uploaded: result.missing.length,
      url: new URL(`/builds/${id}`, server).href,
    };
  }

  private async getScreenshots(directory: string): Promise<LocalScreenshot[]> {
    const manifest = await this.getManifest(join(directory, Constants.Manifest.FileName));
    requireUniqueScreenshots(manifest.screenshots);

    const screenshots: LocalScreenshot[] = [];
    for (const { name, theme, viewport, file } of manifest.screenshots) {
      const path = join(directory, file);
      if (!(await this.storageRepository.exists(path))) {
        throw new SquintError(`Screenshot not found: ${file}`);
      }

      const data = await this.storageRepository.readFile(path);
      const size = this.pngRepository.getSize(data);
      screenshots.push({ screenshot: { name, theme, viewport, ...size, sha256: sha256(data) }, path });
    }

    return screenshots;
  }

  private async getManifest(path: string): Promise<Manifest> {
    if (!(await this.storageRepository.exists(path))) {
      throw new SquintError(`Manifest not found: ${path}`);
    }

    const data = await this.storageRepository.readFile(path);
    const manifest: unknown = JSON.parse(data.toString('utf8'));
    if (!isManifest(manifest)) {
      throw new SquintError(`Invalid manifest: ${path}`);
    }

    return manifest;
  }

  private async getSource(env: GithubEnv, release?: string): Promise<Omit<BuildCreateDto, 'project'>> {
    const commit = requireEnv(env.sha, 'GITHUB_SHA');
    if (release) {
      return { kind: BuildKind.Release, branch: requireEnv(env.refName, 'GITHUB_REF_NAME'), commit, release };
    }

    if (!Constants.Github.PullRequestEvents.has(env.eventName ?? '')) {
      return { kind: BuildKind.Main, branch: requireEnv(env.refName, 'GITHUB_REF_NAME'), commit };
    }

    const match = Constants.Github.PullRequestRef.exec(env.ref ?? '');
    if (!match) {
      throw new SquintError(`Pull request number not found in GITHUB_REF: ${env.ref}`);
    }

    const event = await this.githubRepository.readEvent(requireEnv(env.eventPath, 'GITHUB_EVENT_PATH'));

    return {
      kind: BuildKind.PullRequest,
      branch: requireEnv(env.headRef, 'GITHUB_HEAD_REF'),
      commit: requireEnv(getHeadSha(event), 'pull_request.head.sha'),
      pullRequestNumber: Number(match[1]),
    };
  }

  private getToken({ tokenUrl, tokenRequestToken }: GithubEnv) {
    if (!tokenUrl || !tokenRequestToken) {
      throw new SquintError('GitHub OIDC token not available, add `permissions: id-token: write` to the workflow job');
    }

    const url = new URL(tokenUrl);
    url.searchParams.set('audience', Constants.Publish.Audience);

    return this.githubRepository.getIdToken(url.href, tokenRequestToken);
  }

  private async uploadMissing(screenshots: LocalScreenshot[], missing: string[]) {
    const paths = new Map(screenshots.map(({ screenshot, path }) => [screenshot.sha256, path]));
    for (const sha256 of missing) {
      const path = paths.get(sha256);
      if (!path) {
        throw new SquintError(`Unknown missing blob: ${sha256}`);
      }

      await this.apiRepository.uploadBlob(sha256, await this.storageRepository.readFile(path));
    }
  }

  private async getDiffs(screenshots: LocalScreenshot[], published: ScreenshotResponseDto[]) {
    const changed = published.filter(({ status }) => status === ScreenshotStatus.Changed);
    if (changed.length === 0) {
      return [];
    }

    const paths = new Map(screenshots.map(({ screenshot, path }) => [getKey(screenshot), path]));
    const directory = await this.storageRepository.createTempDirectory();
    try {
      const diffs: DiffDto[] = [];
      for (const [index, screenshot] of changed.entries()) {
        const current = paths.get(getKey(screenshot));
        if (!current || !screenshot.baselineSha256) {
          continue;
        }

        const diff = await this.getDiff(
          screenshot.id,
          screenshot.baselineSha256,
          current,
          join(directory, String(index)),
        );
        if (diff) {
          diffs.push(diff);
        }
      }

      return diffs;
    } finally {
      await this.storageRepository.removeDirectory(directory);
    }
  }

  private async getDiff(screenshotId: string, baselineSha256: string, current: string, prefix: string) {
    const baseline = `${prefix}-baseline.png`;
    const mask = `${prefix}-mask.png`;
    await this.storageRepository.writeFile(baseline, await this.apiRepository.downloadBlob(baselineSha256));

    const result = await this.diffService.diff({ baseline, current, mask });
    if (result.status !== DiffStatus.Changed) {
      return;
    }

    const data = await this.storageRepository.readFile(mask);
    const maskSha256 = sha256(data);
    await this.apiRepository.uploadBlob(maskSha256, data);

    return { screenshotId, sha256: maskSha256, ratio: result.ratio, regions: result.regions };
  }
}

const getCounts = (screenshots: ScreenshotResponseDto[]) => {
  const counts: Partial<Record<ScreenshotStatus, number>> = {};
  for (const { status } of screenshots) {
    counts[status] = (counts[status] ?? 0) + 1;
  }

  return counts;
};

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

const getKey = ({ name, theme, viewport }: { name: string; theme: string; viewport: string }) =>
  JSON.stringify([name, theme, viewport]);

const requireEnv = (value: string | undefined, name: string) => {
  if (!value) {
    throw new SquintError(`Missing ${name}`);
  }

  return value;
};

const isManifest = (value: unknown): value is Manifest =>
  isRecord(value) && Array.isArray(value.screenshots) && value.screenshots.every((entry) => isManifestEntry(entry));

const isManifestEntry = (value: unknown): value is ManifestEntry =>
  isRecord(value) &&
  isText(value.name) &&
  isText(value.viewport) &&
  isText(value.file) &&
  typeof value.theme === 'string' &&
  Constants.Manifest.Themes.has(value.theme);

const getHeadSha = (event: unknown) => {
  if (!isRecord(event) || !isRecord(event.pull_request) || !isRecord(event.pull_request.head)) {
    return;
  }

  const { sha } = event.pull_request.head;

  return typeof sha === 'string' ? sha : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
