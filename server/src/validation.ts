import z from 'zod';
import { Constants } from 'src/constants.js';
import { createZodDto } from 'src/zod.js';

export const isoDatetimeToDate = z
  .codec(z.iso.datetime({ offset: true }), z.date(), {
    decode: (isoString) => new Date(isoString),
    encode: (date) => date.toISOString(),
  })
  .meta({ example: '2026-01-01T00:00:00.000Z' });

export const SearchQuerySchema = z.string().trim().min(1).max(Constants.Builds.MaxQueryLength);

export const stringToBool = z
  .stringbool({ truthy: ['true'], falsy: ['false'], case: 'sensitive' })
  .meta({ type: 'boolean' });

export const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

const UUIDParamSchema = z.object({ id: z.uuid() });

export class UUIDParamDto extends createZodDto(UUIDParamSchema) {}
