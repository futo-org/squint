import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { patchOpenApiParameters, toOpenApiSchema } from '@immich/nestjs-standard-schema';
import { Constants } from 'src/constants.js';

export const createOpenApiDocument = (app: INestApplication): OpenAPIObject => {
  const { Api, Cookies } = Constants;
  const config = new DocumentBuilder()
    .setTitle(Api.Title)
    .setDescription(Api.Description)
    .setVersion(Api.Version)
    .setOpenAPIVersion('3.1.0')
    .addBearerAuth({ type: 'http', scheme: 'Bearer', in: 'header' })
    .addCookieAuth(Cookies.Session.Name)
    .addServer(`/${Api.Prefix}`)
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_: string, methodKey: string) => methodKey,
    ignoreGlobalPrefix: true,
    standardSchemaConverter: toOpenApiSchema,
  });

  patchOpenApiParameters(document);
  for (const schema of Object.values(document.components?.schemas ?? {})) {
    delete (schema as Record<string, unknown>).id;
  }

  return sortKeys(document);
};

const sortKeys = <T>(target: T): T => {
  if (!target || typeof target !== 'object') {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => sortKeys(item)) as T;
  }

  const entries = Object.entries(target).toSorted(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(entries.map(([key, value]) => [key, sortKeys(value)])) as T;
};
