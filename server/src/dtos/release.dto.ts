import z from 'zod';
import { createZodDto } from '@immich/nestjs-standard-schema/zod';
import { ReleaseNoteKind } from 'src/enum.js';
import { isoDatetimeToDate } from 'src/validation.js';

const ReleaseNoteKindSchema = z.enum(ReleaseNoteKind).meta({ id: 'ReleaseNoteKind' });

const ReleaseNoteResponseSchema = z
  .object({ kind: ReleaseNoteKindSchema, text: z.string() })
  .meta({ id: 'ReleaseNoteResponseDto' });

const ReleaseResponseSchema = z
  .object({ version: z.string(), date: isoDatetimeToDate, notes: z.array(ReleaseNoteResponseSchema) })
  .meta({ id: 'ReleaseResponseDto' });

export class ReleaseNoteResponseDto extends createZodDto(ReleaseNoteResponseSchema) {}
export class ReleaseResponseDto extends createZodDto(ReleaseResponseSchema) {}
