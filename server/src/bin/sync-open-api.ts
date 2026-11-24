import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from 'src/app.module.js';
import { Constants } from 'src/constants.js';
import { createOpenApiDocument } from 'src/utils/open-api.js';

const app = await NestFactory.create(AppModule, { preview: true, logger: false });
const path = resolve(process.cwd(), Constants.Api.SpecificationPath);

writeFileSync(path, `${JSON.stringify(createOpenApiDocument(app), undefined, 2)}\n`);
await app.close();

console.log(`Wrote ${path}`);
process.exit(0);
