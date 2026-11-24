import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from 'src/app.common.js';
import { AppModule } from 'src/app.module.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';

const bootstrap = async () => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const { host, port } = app.get(ConfigRepository).getEnv();

  configureApp(app);
  app.enableShutdownHooks();
  await (host ? app.listen(port, host) : app.listen(port));

  app.get(LoggingRepository).log(`Squint is listening on ${await app.getUrl()}`);
};

try {
  await bootstrap();
} catch (error) {
  console.error(error);
  process.exit(1);
}
