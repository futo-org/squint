import z from 'zod';
import { createZodDto } from '@immich/nestjs-standard-schema/zod';
import { Constants } from 'src/constants.js';
import { BuildKind, BuildStatus, PullRequestState, ReviewStatus, ScreenshotStatus, ScreenshotTheme } from 'src/enum.js';
import { isoDatetimeToDate, SearchQuerySchema, Sha256Schema, stringToBool } from 'src/validation.js';

const BuildKindSchema = z.enum(BuildKind).meta({ id: 'BuildKind' });
const BuildStatusSchema = z.enum(BuildStatus).meta({ id: 'BuildStatus' });
const PullRequestStateSchema = z.enum(PullRequestState).meta({ id: 'PullRequestState' });
const ReviewStatusSchema = z.enum(ReviewStatus).meta({ id: 'ReviewStatus' });
export const ScreenshotStatusSchema = z.enum(ScreenshotStatus).meta({ id: 'ScreenshotStatus' });
export const ScreenshotThemeSchema = z.enum(ScreenshotTheme).meta({ id: 'ScreenshotTheme' });
const RatioSchema = z.number().min(0).max(1).meta({ format: 'double' });

const BuildCreateSchema = z
  .strictObject({
    project: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    kind: BuildKindSchema,
    branch: z.string().min(1),
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    pullRequestNumber: z.int().positive().optional(),
    release: z.string().regex(Constants.Builds.ReleasePattern).optional(),
  })
  .refine(({ kind, pullRequestNumber }) => (kind === BuildKind.PullRequest) === (pullRequestNumber !== undefined), {
    path: ['pullRequestNumber'],
    error: 'A pull request build needs a pull request number, and only a pull request build has one',
  })
  .refine(({ kind, release }) => (kind === BuildKind.Release) === (release !== undefined), {
    path: ['release'],
    error: 'A release build needs a release name, and only a release build has one',
  })
  .meta({ id: 'BuildCreateDto' });

const BuildSearchSchema = z.object({
  id: z.uuid().optional(),
  projectId: z.uuid().optional(),
  query: SearchQuerySchema.optional(),
  kind: BuildKindSchema.optional(),
  status: BuildStatusSchema.optional(),
  pullRequestState: PullRequestStateSchema.optional(),
  branch: z.string().min(1).optional(),
  review: ReviewStatusSchema.optional(),
  isTrashed: stringToBool.optional(),
});

const ApprovalSchema = z.object({ name: z.string().min(1) }).meta({ id: 'ApprovalDto' });

const ScreenshotSchema = z
  .object({
    name: z.string().min(1),
    theme: ScreenshotThemeSchema,
    viewport: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    width: z.int().positive(),
    height: z.int().positive(),
    sha256: Sha256Schema,
  })
  .meta({ id: 'ScreenshotDto' });

const BuildScreenshotsSchema = z
  .object({ screenshots: z.array(ScreenshotSchema).max(Constants.Screenshots.MaxPerBuild) })
  .meta({ id: 'BuildScreenshotsDto' });

export const RegionSchema = z
  .object({
    x: z.int().min(0),
    y: z.int().min(0),
    width: z.int().positive(),
    height: z.int().positive(),
  })
  .meta({ id: 'RegionDto' });

const DiffSchema = z
  .object({
    screenshotId: z.uuid(),
    sha256: Sha256Schema,
    ratio: RatioSchema,
    regions: z.array(RegionSchema).max(Constants.Screenshots.MaxDiffRegions),
  })
  .meta({ id: 'DiffDto' });

const BuildCompleteSchema = z.object({ diffs: z.array(DiffSchema) }).meta({ id: 'BuildCompleteDto' });

const PullRequestResponseSchema = z
  .object({
    number: z.int(),
    title: z.string().nullable(),
    state: PullRequestStateSchema,
    url: z.string(),
  })
  .meta({ id: 'PullRequestResponseDto' });

const build = {
  id: z.uuid(),
  projectId: z.uuid(),
  kind: BuildKindSchema,
  branch: z.string(),
  commit: z.string(),
  pullRequest: PullRequestResponseSchema.nullable(),
  release: z.string().nullable(),
  reviewableCount: z.int(),
  approvedCount: z.int(),
  review: ReviewStatusSchema.nullable(),
  status: BuildStatusSchema,
  baselineBuildId: z.uuid().nullable(),
  createdAt: isoDatetimeToDate,
  completedAt: isoDatetimeToDate.nullable(),
  trashedAt: isoDatetimeToDate.nullable(),
  expiresAt: isoDatetimeToDate.nullable(),
};

const BuildResponseSchema = z.object(build).meta({ id: 'BuildResponseDto' });

const screenshot = {
  id: z.uuid(),
  name: z.string(),
  theme: ScreenshotThemeSchema,
  viewport: z.string(),
  width: z.int(),
  height: z.int(),
  status: ScreenshotStatusSchema,
  sha256: z.string().nullable(),
  baselineSha256: z.string().nullable(),
  diffSha256: z.string().nullable(),
  diffRatio: RatioSchema.nullable(),
  diffRegions: z.array(RegionSchema).nullable(),
};

const ScreenshotResponseSchema = z.object(screenshot).meta({ id: 'ScreenshotResponseDto' });

const ApprovalResponseSchema = z
  .object({ userId: z.uuid(), userName: z.string(), createdAt: isoDatetimeToDate })
  .meta({ id: 'ApprovalResponseDto' });

const ReviewScreenshotResponseSchema = z
  .object({ ...screenshot, approval: ApprovalResponseSchema.nullable() })
  .meta({ id: 'ReviewScreenshotResponseDto' });

const BuildDetailResponseSchema = z
  .object({ ...build, screenshots: z.array(ReviewScreenshotResponseSchema) })
  .meta({ id: 'BuildDetailResponseDto' });

const BuildScreenshotsResponseSchema = z
  .object({
    baselineBuildId: z.uuid().nullable(),
    screenshots: z.array(ScreenshotResponseSchema),
    missing: z.array(z.string()),
  })
  .meta({ id: 'BuildScreenshotsResponseDto' });

export class BuildCreateDto extends createZodDto(BuildCreateSchema) {}
export class BuildSearchDto extends createZodDto(BuildSearchSchema) {}
export class ApprovalDto extends createZodDto(ApprovalSchema) {}
export class ScreenshotDto extends createZodDto(ScreenshotSchema) {}
export class BuildScreenshotsDto extends createZodDto(BuildScreenshotsSchema) {}
export class BuildCompleteDto extends createZodDto(BuildCompleteSchema) {}
export class PullRequestResponseDto extends createZodDto(PullRequestResponseSchema) {}
export class BuildResponseDto extends createZodDto(BuildResponseSchema) {}
export class ScreenshotResponseDto extends createZodDto(ScreenshotResponseSchema) {}
export class ApprovalResponseDto extends createZodDto(ApprovalResponseSchema) {}
export class ReviewScreenshotResponseDto extends createZodDto(ReviewScreenshotResponseSchema) {}
export class BuildDetailResponseDto extends createZodDto(BuildDetailResponseSchema) {}
export class BuildScreenshotsResponseDto extends createZodDto(BuildScreenshotsResponseSchema) {}
