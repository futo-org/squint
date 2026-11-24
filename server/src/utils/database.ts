import { createPostgres } from '@immich/sql-tools';
import { type KyselyConfig, sql } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';

export const getKyselyConfig = (url: string): KyselyConfig => ({
  dialect: new PostgresJSDialect({ postgres: createPostgres({ connection: { connectionType: 'url', url } }) }),
  log(event) {
    if (event.level !== 'error') {
      return;
    }

    console.error('Query failed:', {
      durationMs: event.queryDurationMillis,
      error: event.error,
      sql: event.query.sql,
      params: event.query.parameters,
    });
  },
});

export const isSame = (left: string, right: string) =>
  sql<boolean>`${sql.ref(left)} is not distinct from ${sql.ref(right)}`;

export const isSameValue = (column: string, value: string | null) =>
  sql<boolean>`${sql.ref(column)} is not distinct from ${value}`;

const escapeLike = (value: string) => value.replaceAll(/[\\%_]/g, String.raw`\$&`);

export const toContainsPattern = (value: string) => `%${escapeLike(value)}%`;

export const toPrefixPattern = (value: string) => `${escapeLike(value)}%`;
