import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import sirv from 'sirv';
import { Constants } from 'src/constants.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';

export const configureApp = (app: NestExpressApplication): void => {
  const { network, web } = app.get(ConfigRepository).getEnv();
  const { Api, Blobs, Web } = Constants;

  app.set('trust proxy', network.trustedProxies);
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.useBodyParser('json', { limit: Api.JsonLimit });
  app.useBodyParser('raw', { type: [Blobs.UploadContentType, Blobs.ContentType], limit: Blobs.MaxBytes });
  app.setGlobalPrefix(Api.Prefix);

  if (!existsSync(web.root)) {
    return;
  }

  app.use(
    sirv(web.root, {
      etag: true,
      single: true,
      ignores: [new RegExp(`^/${Api.Prefix}(/|$)`)],
      setHeaders: (response, pathname) => {
        if (pathname.startsWith(Web.ImmutablePath) && response.statusCode === 200) {
          response.setHeader('cache-control', Web.ImmutableCacheControl);
        }
      },
    }),
  );
};
