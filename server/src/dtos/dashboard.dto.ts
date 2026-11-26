import z from 'zod';
import { createZodDto } from '@immich/nestjs-standard-schema/zod';

const DashboardHistoryResponseSchema = z
  .object({ projectId: z.uuid(), date: z.iso.date(), screenshotCount: z.int() })
  .meta({ id: 'DashboardHistoryResponseDto' });

const DashboardResponseSchema = z
  .object({ history: z.array(DashboardHistoryResponseSchema) })
  .meta({ id: 'DashboardResponseDto' });

export class DashboardHistoryResponseDto extends createZodDto(DashboardHistoryResponseSchema) {}
export class DashboardResponseDto extends createZodDto(DashboardResponseSchema) {}
