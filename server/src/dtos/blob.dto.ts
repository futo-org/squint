import z from 'zod';
import { Sha256Schema } from 'src/validation.js';
import { createZodDto } from 'src/zod.js';

const BlobParamSchema = z.object({ sha256: Sha256Schema });

const BlobResponseSchema = z.object({ sha256: Sha256Schema }).meta({ id: 'BlobResponseDto' });

export class BlobParamDto extends createZodDto(BlobParamSchema) {}
export class BlobResponseDto extends createZodDto(BlobResponseSchema) {}
