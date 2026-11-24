import { Injectable } from '@nestjs/common';
import { join } from 'node:path';
import z from 'zod';

const HttpUrlSchema = z.url({ protocol: /^https?$/ });

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const EnvSchema = z.object({
  SQUINT_DB_URL: z.url({ protocol: /^postgres(ql)?$/ }).default('postgres://postgres:postgres@localhost:5432/squint'),
  SQUINT_HOST: optional(z.string()),
  SQUINT_PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
  SQUINT_WEB_ROOT: z.string().default(join(import.meta.dirname, '..', '..', '..', 'web', 'build')),
  SQUINT_TRUSTED_PROXIES: z.string().default('loopback,linklocal,uniquelocal'),
  SQUINT_CI_OWNERS: z.string().default('futo-org,immich-app'),
  SQUINT_BUILD_COMMIT: optional(z.string().regex(/^[0-9a-f]{40}$/)),
  SQUINT_BUILD_DATE: optional(z.iso.datetime({ offset: true })),
  SQUINT_S3_ENDPOINT: optional(HttpUrlSchema),
  SQUINT_S3_REGION: z.string().min(1).default('us-east-1'),
  SQUINT_S3_BUCKET: z.string().min(1),
  SQUINT_S3_ACCESS_KEY_ID: z.string().min(1),
  SQUINT_S3_SECRET_ACCESS_KEY: z.string().min(1),
  SQUINT_S3_FORCE_PATH_STYLE: z.stringbool().default(false),
  SQUINT_OAUTH_ISSUER: HttpUrlSchema.default('https://auth.internal.futo.org'),
  SQUINT_OAUTH_CLIENT_ID: z.string().default(''),
  SQUINT_OAUTH_CLIENT_SECRET: z.string().default(''),
  SQUINT_GITHUB_OIDC_ISSUER: HttpUrlSchema.default('https://token.actions.githubusercontent.com'),
  SQUINT_GITHUB_WEBHOOK_SECRET: z.string().default(''),
});

export type EnvData = {
  host?: string;
  port: number;
  build: { commit?: string; date?: Date };
  database: { url: string };
  storage: {
    endpoint?: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  };
  web: { root: string };
  network: { trustedProxies: string[] };
  oauth: { issuer: string; clientId: string; clientSecret: string };
  github: { oidcIssuer: string; webhookSecret: string; owners: string[] };
};

@Injectable()
export class ConfigRepository {
  private env?: EnvData;

  getEnv(): EnvData {
    this.env ??= this.readEnv();

    return this.env;
  }

  private readEnv(): EnvData {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(`Invalid environment variables\n${z.prettifyError(result.error)}`);
    }

    const env = result.data;

    return {
      host: env.SQUINT_HOST,
      port: env.SQUINT_PORT,
      build: {
        commit: env.SQUINT_BUILD_COMMIT,
        date: env.SQUINT_BUILD_DATE ? new Date(env.SQUINT_BUILD_DATE) : undefined,
      },
      database: { url: env.SQUINT_DB_URL },
      storage: {
        endpoint: env.SQUINT_S3_ENDPOINT,
        region: env.SQUINT_S3_REGION,
        bucket: env.SQUINT_S3_BUCKET,
        accessKeyId: env.SQUINT_S3_ACCESS_KEY_ID,
        secretAccessKey: env.SQUINT_S3_SECRET_ACCESS_KEY,
        forcePathStyle: env.SQUINT_S3_FORCE_PATH_STYLE,
      },
      web: { root: env.SQUINT_WEB_ROOT },
      network: { trustedProxies: splitList(env.SQUINT_TRUSTED_PROXIES) },
      oauth: {
        issuer: env.SQUINT_OAUTH_ISSUER,
        clientId: env.SQUINT_OAUTH_CLIENT_ID,
        clientSecret: env.SQUINT_OAUTH_CLIENT_SECRET,
      },
      github: {
        oidcIssuer: env.SQUINT_GITHUB_OIDC_ISSUER,
        webhookSecret: env.SQUINT_GITHUB_WEBHOOK_SECRET,
        owners: splitList(env.SQUINT_CI_OWNERS),
      },
    };
  }
}

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
