import { createPostgres } from '@immich/sql-tools';
import { Kysely, sql } from 'kysely';
import { DatabaseRepository } from 'src/repositories/database.repository.js';
import type { DB } from 'src/schema/index.js';
import { getKyselyConfig } from 'src/utils/database.js';
import { TEST_POSTGRES_URL } from 'test/constants.js';

describe(DatabaseRepository.name, () => {
  let db: Kysely<DB>;
  let sut: DatabaseRepository;

  const getTables = async () => {
    const query = sql<{
      name: string;
    }>`select table_name as name from information_schema.tables where table_schema = 'public' order by table_name`;
    const { rows } = await query.execute(db);

    return rows.map(({ name }) => name);
  };

  beforeEach(async () => {
    const url = new URL(process.env[TEST_POSTGRES_URL] ?? '');
    const name = `squint_empty_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const admin = createPostgres({ maxConnections: 1, connection: { connectionType: 'url', url: url.href } });
    await admin.unsafe(`CREATE DATABASE ${name};`);
    await admin.end();
    url.pathname = `/${name}`;

    db = new Kysely<DB>(getKyselyConfig(url.href));
    sut = new DatabaseRepository(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  describe('runMigrations', () => {
    it('creates every table on an empty database', async () => {
      await sut.runMigrations();

      await expect(getTables()).resolves.toEqual([
        'approval',
        'blob',
        'build',
        'kysely_migrations',
        'kysely_migrations_lock',
        'project',
        'pull_request',
        'screenshot',
        'screenshot_version',
        'session',
        'user',
      ]);
    });

    it('reports the migrations it ran', async () => {
      await expect(sut.runMigrations()).resolves.toEqual(['1795026119362-InitialMigration']);
    });

    it('runs nothing on a database that is up to date', async () => {
      await sut.runMigrations();

      await expect(sut.runMigrations()).resolves.toEqual([]);
    });

    it('runs once when two servers start together', async () => {
      const results = await Promise.all([sut.runMigrations(), new DatabaseRepository(db).runMigrations()]);

      expect(results.flat()).toEqual(['1795026119362-InitialMigration']);
    });
  });
});
