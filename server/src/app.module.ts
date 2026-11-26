import { Module, type OnModuleInit } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { KyselyModule } from 'nestjs-kysely';
import { registerSchemas } from '@immich/nestjs-standard-schema';
import { controllers } from 'src/controllers/index.js';
import { EventGateway } from 'src/gateways/event.gateway.js';
import { AuthGuard } from 'src/middleware/auth.guard.js';
import { GlobalExceptionFilter } from 'src/middleware/global-exception.filter.js';
import { GlobalValidationPipe } from 'src/middleware/global-validation.pipe.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';
import { repositories } from 'src/repositories/index.js';
import { DatabaseService } from 'src/services/database.service.js';
import { services } from 'src/services/index.js';
import { getKyselyConfig } from 'src/utils/database.js';

@Module({
  imports: [
    KyselyModule.forRootAsync({
      useFactory: () => getKyselyConfig(new ConfigRepository().getEnv().database.url),
    }),
  ],
  controllers: [...controllers],
  providers: [
    ...repositories,
    ...services,
    EventGateway,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_PIPE, useClass: GlobalValidationPipe },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule implements OnModuleInit {
  static {
    registerSchemas({ controllers });
  }

  constructor(private databaseService: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.databaseService.migrate();
  }
}
