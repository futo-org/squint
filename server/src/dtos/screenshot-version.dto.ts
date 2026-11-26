import z from 'zod';
import { createZodDto } from '@immich/nestjs-standard-schema/zod';
import { RegionSchema, ScreenshotStatusSchema, ScreenshotThemeSchema } from 'src/dtos/build.dto.js';
import { isoDatetimeToDate } from 'src/validation.js';

const ScreenshotVersionSearchSchema = z.object({
  id: z.uuid().optional(),
  projectId: z.uuid().optional(),
  name: z.string().min(1).optional(),
  theme: ScreenshotThemeSchema.optional(),
  viewport: z.string().min(1).optional(),
});

const ScreenshotVersionResponseSchema = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    name: z.string(),
    theme: ScreenshotThemeSchema,
    viewport: z.string(),
    width: z.int(),
    height: z.int(),
    status: ScreenshotStatusSchema,
    sha256: z.string().nullable(),
    baselineSha256: z.string().nullable(),
    diffSha256: z.string().nullable(),
    diffRatio: z.number().min(0).max(1).meta({ format: 'double' }).nullable(),
    diffRegions: z.array(RegionSchema).nullable(),
    commit: z.string(),
    commitUrl: z.string(),
    createdAt: isoDatetimeToDate,
  })
  .meta({ id: 'ScreenshotVersionResponseDto' });

export class ScreenshotVersionSearchDto extends createZodDto(ScreenshotVersionSearchSchema) {}
export class ScreenshotVersionResponseDto extends createZodDto(ScreenshotVersionResponseSchema) {}
