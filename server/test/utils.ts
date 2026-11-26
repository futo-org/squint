import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { Provider } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createPostgres } from '@immich/sql-tools';
import { Kysely } from 'kysely';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { type Mock, vi } from 'vitest';
import { registerSchemas } from '@immich/nestjs-standard-schema';
import { configureApp } from 'src/app.common.js';
import type { CiAuthDto } from 'src/dtos/auth.dto.js';
import { AuthGuard } from 'src/middleware/auth.guard.js';
import { GlobalExceptionFilter } from 'src/middleware/global-exception.filter.js';
import { GlobalValidationPipe } from 'src/middleware/global-validation.pipe.js';
import { ConfigRepository, type EnvData } from 'src/repositories/config.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';
import type { DB } from 'src/schema/index.js';
import { AuthService } from 'src/services/auth.service.js';
import { getKyselyConfig } from 'src/utils/database.js';
import {
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  TEMPLATE_DATABASE,
  TEST_POSTGRES_URL,
  TEST_S3_ENDPOINT,
  WEBHOOK_SECRET,
} from 'test/constants.js';
import { GITHUB_ISSUER } from 'test/github-actions.js';
import { CLIENT_ID, CLIENT_SECRET, ISSUER } from 'test/identity-provider.js';

type ControllerClass = new (...args: never[]) => unknown;

export type ControllerContext = {
  authenticate: Mock;
  authenticateCi: Mock;
  getHttpServer: () => ReturnType<NestExpressApplication['getHttpServer']>;
  close: () => Promise<void>;
};

export const newEnv = (overrides: Partial<EnvData> = {}): EnvData => ({
  port: 0,
  build: {},
  database: { url: '' },
  storage: {
    region: 'us-east-1',
    bucket: '',
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    forcePathStyle: true,
  },
  web: { root: '' },
  network: { trustedProxies: ['loopback'] },
  oauth: { issuer: ISSUER, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
  github: { oidcIssuer: GITHUB_ISSUER, webhookSecret: WEBHOOK_SECRET, owners: ['immich-app'] },
  ...overrides,
});

export const newConfigRepository = (overrides: Partial<EnvData> = {}) => {
  const env = newEnv(overrides);

  return { getEnv: () => env } as ConfigRepository;
};

export const controllerSetup = async (
  controller: ControllerClass,
  providers: Provider[] = [],
): Promise<ControllerContext> => {
  const authService = { authenticate: vi.fn(), authenticateCi: vi.fn() };
  registerSchemas({ controllers: [controller] });
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: [
      { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      { provide: APP_PIPE, useClass: GlobalValidationPipe },
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: LoggingRepository, useValue: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      { provide: ConfigRepository, useValue: newConfigRepository() },
      { provide: AuthService, useValue: authService },
      ...providers,
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  configureApp(app);
  await app.init();

  const resolved = app.get<typeof authService>(AuthService);

  return {
    authenticate: resolved.authenticate,
    authenticateCi: resolved.authenticateCi,
    getHttpServer: () => app.getHttpServer(),
    close: () => app.close(),
  };
};

export const getKyselyDB = async (): Promise<Kysely<DB>> => {
  const templateUrl = process.env[TEST_POSTGRES_URL];
  if (!templateUrl) {
    throw new Error('The medium test database is not running');
  }

  const name = `squint_${randomBytes(6).toString('hex')}`;
  const admin = createPostgres({
    maxConnections: 1,
    connection: { connectionType: 'url', url: withDatabase(templateUrl, 'postgres') },
  });
  await admin.unsafe(`CREATE DATABASE ${name} WITH TEMPLATE ${TEMPLATE_DATABASE} OWNER postgres;`);
  await admin.end();

  return new Kysely<DB>(getKyselyConfig(withDatabase(templateUrl, name)));
};

export const newStorageEnv = async (): Promise<EnvData['storage']> => {
  const endpoint = process.env[TEST_S3_ENDPOINT];
  if (!endpoint) {
    throw new Error('The medium test storage is not running');
  }

  const storage = { ...newEnv().storage, endpoint, bucket: `squint-${randomBytes(6).toString('hex')}` };
  const { region, accessKeyId, secretAccessKey, forcePathStyle } = storage;
  const client = new S3Client({ endpoint, region, forcePathStyle, credentials: { accessKeyId, secretAccessKey } });
  await client.send(new CreateBucketCommand({ Bucket: storage.bucket }));
  client.destroy();

  return storage;
};

const withDatabase = (url: string, database: string) => {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;

  return parsed.href;
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export const newPng = (content: string) => new Uint8Array([...PNG_SIGNATURE, ...new TextEncoder().encode(content)]);

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export const signWebhook = (body: string, secret: string) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

export const newCiAuth = (overrides: Partial<CiAuthDto> = {}): CiAuthDto => ({
  repository: 'immich-app/static-pages',
  owner: 'immich-app',
  ref: 'refs/heads/main',
  workflowRef: 'immich-app/static-pages/.github/workflows/squint.yml@refs/heads/main',
  ...overrides,
});
