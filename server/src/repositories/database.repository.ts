import { Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { InjectKysely } from 'nestjs-kysely';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Constants } from 'src/constants.js';
import type { DB } from 'src/schema/index.js';

@Injectable()
export class DatabaseRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  async runMigrations(): Promise<string[]> {
    const migrator = new Migrator({
      db: this.db,
      migrationTableName: Constants.Database.MigrationTable,
      migrationLockTableName: Constants.Database.MigrationLockTable,
      provider: new FileMigrationProvider({
        fs: { readdir },
        path: { join },
        import: (path) => import(path),
        migrationFolder: join(import.meta.dirname, '..', 'schema', 'migrations'),
      }),
    });

    const { error, results = [] } = await migrator.migrateToLatest();
    if (error) {
      throw error;
    }

    return results.map(({ migrationName }) => migrationName);
  }
}
