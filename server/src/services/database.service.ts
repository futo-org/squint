import { Injectable } from '@nestjs/common';
import { DatabaseRepository } from 'src/repositories/database.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';

@Injectable()
export class DatabaseService {
  constructor(
    private databaseRepository: DatabaseRepository,
    private logger: LoggingRepository,
  ) {}

  async migrate(): Promise<void> {
    const migrations = await this.databaseRepository.runMigrations();
    for (const migration of migrations) {
      this.logger.log(`Migration "${migration}" succeeded`);
    }
  }
}
