import z from 'zod';
import { createZodDto } from '@immich/nestjs-standard-schema/zod';
import { isoDatetimeToDate } from 'src/validation.js';

const ServerPingResponseSchema = z.object({ res: z.string() }).meta({ id: 'ServerPingResponseDto' });

const ServerAboutResponseSchema = z
  .object({
    version: z.string(),
    repositoryUrl: z.string(),
    commit: z.string().nullable(),
    commitUrl: z.string().nullable(),
    buildDate: isoDatetimeToDate.nullable(),
  })
  .meta({ id: 'ServerAboutResponseDto' });

export class ServerPingResponseDto extends createZodDto(ServerPingResponseSchema) {}
export class ServerAboutResponseDto extends createZodDto(ServerAboutResponseSchema) {}
