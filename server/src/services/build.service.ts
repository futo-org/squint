import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Constants } from 'src/constants.js';
import type { AuthDto, CiAuthDto } from 'src/dtos/auth.dto.js';
import type {
  ApprovalDto,
  BuildCompleteDto,
  BuildCreateDto,
  BuildDetailResponseDto,
  BuildResponseDto,
  BuildScreenshotsDto,
  BuildScreenshotsResponseDto,
  BuildSearchDto,
  ScreenshotDto,
  ScreenshotResponseDto,
} from 'src/dtos/build.dto.js';
import { BuildKind, BuildStatus, PullRequestState, ScreenshotStatus, UserRole } from 'src/enum.js';
import { ApprovalRepository } from 'src/repositories/approval.repository.js';
import { BlobRepository } from 'src/repositories/blob.repository.js';
import { BuildRepository } from 'src/repositories/build.repository.js';
import { ProjectRepository } from 'src/repositories/project.repository.js';
import { PullRequestRepository } from 'src/repositories/pull-request.repository.js';
import { ScreenshotVersionRepository } from 'src/repositories/screenshot-version.repository.js';
import { ScreenshotRepository } from 'src/repositories/screenshot.repository.js';
import { WebsocketRepository } from 'src/repositories/websocket.repository.js';

@Injectable()
export class BuildService {
  constructor(
    private approvalRepository: ApprovalRepository,
    private blobRepository: BlobRepository,
    private buildRepository: BuildRepository,
    private projectRepository: ProjectRepository,
    private pullRequestRepository: PullRequestRepository,
    private screenshotRepository: ScreenshotRepository,
    private screenshotVersionRepository: ScreenshotVersionRepository,
    private websocketRepository: WebsocketRepository,
  ) {}

  async search(dto: BuildSearchDto): Promise<BuildResponseDto[]> {
    const builds = await this.buildRepository.search(dto);

    return builds.map((build) => this.mapBuild(build));
  }

  async get(id: string): Promise<BuildDetailResponseDto> {
    const build = await this.buildRepository.getById(id);
    if (!build) {
      throw new NotFoundException();
    }

    const response = this.mapBuild(build);
    const screenshots = await this.screenshotRepository.getByBuildId(id);
    const approvals = await this.approvalRepository.getByBuildId(id);
    const approvalsById = new Map(approvals.map(({ screenshotId, ...approval }) => [screenshotId, approval]));

    return {
      ...response,
      screenshots: screenshots.map((screenshot) => ({
        ...this.mapScreenshot(screenshot),
        approval: approvalsById.get(screenshot.id) ?? null,
      })),
    };
  }

  async approve(auth: AuthDto, id: string, dto: ApprovalDto): Promise<void> {
    const screenshots = await this.requireReviewable(auth, id, dto);

    await this.approvalRepository.createMany(
      screenshots.map(({ projectId, name, theme, viewport, baselineSha256, sha256 }) => ({
        projectId,
        name,
        theme,
        viewport,
        baselineSha256,
        sha256,
        userId: auth.user.id,
      })),
    );
    this.websocketRepository.update('/builds');
  }

  async revoke(auth: AuthDto, id: string, dto: ApprovalDto): Promise<void> {
    const screenshots = await this.requireReviewable(auth, id, dto);

    await this.approvalRepository.deleteMany(screenshots);
    this.websocketRepository.update('/builds');
  }

  async create(auth: CiAuthDto, dto: BuildCreateDto): Promise<BuildResponseDto> {
    if (!this.canPublish(auth, dto.kind)) {
      throw new ForbiddenException();
    }

    const project = await this.projectRepository.upsert({ repository: auth.repository, name: dto.project });
    const pullRequestNumber = dto.pullRequestNumber ?? null;
    if (pullRequestNumber !== null) {
      await this.pullRequestRepository.createIfMissing({
        repository: auth.repository,
        number: pullRequestNumber,
        title: null,
        state: PullRequestState.Open,
      });
    }

    const { id } = await this.buildRepository.create({
      projectId: project.id,
      kind: dto.kind,
      branch: dto.branch,
      commit: dto.commit,
      pullRequestNumber,
      release: dto.release ?? null,
      baselineBuildId: null,
      createdAt: new Date(),
      completedAt: null,
    });
    this.websocketRepository.update('/builds', '/projects');
    const { screenshots: _screenshots, ...build } = await this.get(id);

    return build;
  }

  async setScreenshots(auth: CiAuthDto, id: string, dto: BuildScreenshotsDto): Promise<BuildScreenshotsResponseDto> {
    const build = await this.requirePending(auth, id);
    const published = new Map(dto.screenshots.map((screenshot) => [this.getKey(screenshot), screenshot]));
    if (published.size !== dto.screenshots.length) {
      throw new BadRequestException('A screenshot is listed more than once');
    }

    const baseline = await this.buildRepository.getBaseline(build);
    const baselineScreenshots = baseline ? await this.screenshotRepository.getByBuildId(baseline.id) : [];
    const current = baselineScreenshots.filter(({ sha256 }) => sha256 !== null);
    const baselineHashes = new Map(current.map((screenshot) => [this.getKey(screenshot), screenshot.sha256]));
    const removed = current.filter((screenshot) => !published.has(this.getKey(screenshot)));

    const rows = [
      ...dto.screenshots.map((screenshot) => ({
        ...screenshot,
        ...this.compare(screenshot, baselineHashes.get(this.getKey(screenshot)) ?? null),
      })),
      ...removed.map(({ name, theme, viewport, width, height, sha256 }) => ({
        name,
        theme,
        viewport,
        width,
        height,
        sha256: null,
        baselineSha256: sha256,
        status: ScreenshotStatus.Removed,
      })),
    ].map((row) => ({ ...row, buildId: id, diffSha256: null, diffRatio: null, diffRegions: null }));

    const screenshots = await this.screenshotRepository.replaceByBuildId(id, rows);
    await this.buildRepository.setBaseline(id, baseline?.id ?? null);
    this.websocketRepository.update(`/builds/${id}`);

    const hashes = [...new Set(dto.screenshots.map(({ sha256 }) => sha256))];
    const existing = await this.blobRepository.getExisting(hashes);

    return {
      baselineBuildId: baseline?.id ?? null,
      screenshots: screenshots.map((screenshot) => this.mapScreenshot(screenshot)),
      missing: hashes.filter((sha256) => !existing.has(sha256)),
    };
  }

  async complete(auth: CiAuthDto, id: string, dto: BuildCompleteDto): Promise<BuildResponseDto> {
    const { kind } = await this.requirePending(auth, id);

    const screenshots = await this.screenshotRepository.getByBuildId(id);
    const changed = new Set(
      screenshots.filter(({ status }) => status === ScreenshotStatus.Changed).map((screenshot) => screenshot.id),
    );
    if (dto.diffs.some(({ screenshotId }) => !changed.has(screenshotId))) {
      throw new BadRequestException('A diff does not belong to a changed screenshot');
    }

    const published = screenshots.map(({ sha256 }) => sha256).filter((sha256) => sha256 !== null);
    const hashes = [...new Set([...published, ...dto.diffs.map(({ sha256 }) => sha256)])];
    const existing = await this.blobRepository.getExisting(hashes);
    if (hashes.some((sha256) => !existing.has(sha256))) {
      throw new BadRequestException('Screenshots are missing');
    }

    await this.buildRepository.complete({ id, diffs: dto.diffs });
    if (kind === BuildKind.Main) {
      await this.screenshotVersionRepository.createFromBuild(id);
    }

    await this.buildRepository.trashOutdated(new Date());
    this.websocketRepository.update('/builds', '/projects', '/dashboard', '/screens', '/screenshot-versions');
    const { screenshots: _screenshots, ...build } = await this.get(id);

    return build;
  }

  private canPublish({ workflowRef }: CiAuthDto, kind: BuildKind) {
    switch (kind) {
      case BuildKind.Main: {
        return workflowRef.endsWith(Constants.Ci.MainWorkflowSuffix);
      }
      case BuildKind.Release: {
        return Constants.Ci.ReleaseWorkflowRef.test(workflowRef);
      }
      case BuildKind.PullRequest: {
        return true;
      }
    }
  }

  private async requireReviewable(auth: AuthDto, id: string, { name }: ApprovalDto) {
    if (auth.user.role !== UserRole.Approver) {
      throw new ForbiddenException();
    }

    const build = await this.buildRepository.getById(id);
    const screenshots = await this.screenshotRepository.getByBuildId(id);
    const screen = screenshots.filter((screenshot) => screenshot.name === name);
    if (!build || screen.length === 0) {
      throw new NotFoundException();
    }

    const reviewable = screen.filter(({ status }) => status !== ScreenshotStatus.Unchanged);
    if (reviewable.length === 0) {
      throw new BadRequestException('An unchanged screen needs no approval');
    }

    return reviewable.map((screenshot) => ({ ...screenshot, projectId: build.projectId }));
  }

  private async requirePending(auth: CiAuthDto, id: string) {
    const build = await this.buildRepository.getById(id);
    if (!build || build.repository !== auth.repository) {
      throw new NotFoundException();
    }

    if (build.status !== BuildStatus.Pending) {
      throw new BadRequestException('Build is already complete');
    }

    return build;
  }

  private mapBuild(build: NonNullable<Awaited<ReturnType<BuildRepository['getById']>>>): BuildResponseDto {
    const {
      repository,
      pullRequestNumber,
      pullRequestTitle,
      pullRequestState,
      reviewableCount,
      approvedCount,
      isLatest: _isLatest,
      deletedAt,
      ...rest
    } = build;

    return {
      ...rest,
      reviewableCount: reviewableCount ?? 0,
      approvedCount: approvedCount ?? 0,
      trashedAt: deletedAt,
      expiresAt: deletedAt && new Date(deletedAt.getTime() + Constants.Trash.RetentionMs),
      pullRequest:
        pullRequestNumber === null
          ? null
          : {
              number: pullRequestNumber,
              title: pullRequestTitle,
              state: pullRequestState ?? PullRequestState.Open,
              url: `${Constants.Github.Url}/${repository}/pull/${pullRequestNumber}`,
            },
    };
  }

  private getKey({ name, theme, viewport }: { name: string; theme: string; viewport: string }) {
    return JSON.stringify([name, viewport, theme]);
  }

  private compare(screenshot: ScreenshotDto, baselineSha256: string | null) {
    if (baselineSha256 === null) {
      return { baselineSha256, status: ScreenshotStatus.New };
    }

    const status = baselineSha256 === screenshot.sha256 ? ScreenshotStatus.Unchanged : ScreenshotStatus.Changed;

    return { baselineSha256, status };
  }

  private mapScreenshot(screenshot: ScreenshotResponseDto): ScreenshotResponseDto {
    const { id, name, theme, viewport, width, height, status, sha256, baselineSha256 } = screenshot;
    const { diffSha256, diffRatio, diffRegions } = screenshot;

    return {
      id,
      name,
      theme,
      viewport,
      width,
      height,
      status,
      sha256,
      baselineSha256,
      diffSha256,
      diffRatio,
      diffRegions,
    };
  }
}
