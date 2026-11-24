import z from 'zod';
import { isoDatetimeToDate, SearchQuerySchema } from 'src/validation.js';
import { createZodDto } from 'src/zod.js';

const ProjectSearchSchema = z.object({
  id: z.uuid().optional(),
  query: SearchQuerySchema.optional(),
  repository: z.string().min(1).optional(),
});

const ProjectResponseSchema = z
  .object({
    id: z.uuid(),
    repository: z.string(),
    name: z.string(),
    createdAt: isoDatetimeToDate,
    screenshotCount: z.int(),
    openPullRequestCount: z.int(),
  })
  .meta({ id: 'ProjectResponseDto' });

export class ProjectSearchDto extends createZodDto(ProjectSearchSchema) {}
export class ProjectResponseDto extends createZodDto(ProjectResponseSchema) {}
