import z from 'zod';
import { isoDatetimeToDate, SearchQuerySchema } from 'src/validation.js';
import { createZodDto } from 'src/zod.js';

const ScreenSearchSchema = z.object({ projectId: z.uuid().optional(), query: SearchQuerySchema.optional() });

const ScreenResponseSchema = z
  .object({ projectId: z.uuid(), name: z.string(), versionCount: z.int(), updatedAt: isoDatetimeToDate })
  .meta({ id: 'ScreenResponseDto' });

export class ScreenSearchDto extends createZodDto(ScreenSearchSchema) {}
export class ScreenResponseDto extends createZodDto(ScreenResponseSchema) {}
