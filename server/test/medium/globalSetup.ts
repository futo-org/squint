import { Kysely } from 'kysely';
import { GenericContainer, Wait } from 'testcontainers';
import { DatabaseRepository } from 'src/repositories/database.repository.js';
import type { DB } from 'src/schema/index.js';
import { getKyselyConfig } from 'src/utils/database.js';
import {
  POSTGRES_IMAGE,
  S3_IMAGE,
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  TEMPLATE_DATABASE,
  TEST_POSTGRES_URL,
  TEST_S3_ENDPOINT,
} from 'test/constants.js';

const startStorage = async () => {
  const container = await new GenericContainer(S3_IMAGE)
    .withExposedPorts(9000)
    .withEnvironment({ RUSTFS_ACCESS_KEY: S3_ACCESS_KEY_ID, RUSTFS_SECRET_KEY: S3_SECRET_ACCESS_KEY })
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  process.env[TEST_S3_ENDPOINT] = `http://localhost:${container.getMappedPort(9000)}`;

  return container;
};

const globalSetup = async () => {
  const storage = await startStorage();
  const container = await new GenericContainer(POSTGRES_IMAGE)
    .withExposedPorts(5432)
    .withEnvironment({ POSTGRES_PASSWORD: 'postgres', POSTGRES_USER: 'postgres', POSTGRES_DB: TEMPLATE_DATABASE })
    .withCommand(['postgres', '-c', 'fsync=off', '-c', 'full_page_writes=off', '-c', 'synchronous_commit=off'])
    .withTmpFs({ '/var/lib/postgresql': 'rw' })
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
    .start();

  const url = `postgres://postgres:postgres@localhost:${container.getMappedPort(5432)}/${TEMPLATE_DATABASE}`;
  process.env[TEST_POSTGRES_URL] = url;

  const db = new Kysely<DB>(getKyselyConfig(url));
  await new DatabaseRepository(db).runMigrations();
  await db.destroy();

  return async () => {
    await container.stop();
    await storage.stop();
  };
};

export default globalSetup;
