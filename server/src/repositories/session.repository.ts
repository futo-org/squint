import { Injectable } from '@nestjs/common';
import type { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from 'src/schema/index.js';
import type { SessionTable } from 'src/schema/tables/session.table.js';

@Injectable()
export class SessionRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  async create(session: Insertable<SessionTable>): Promise<void> {
    await this.db.insertInto('session').values(session).execute();
  }

  getByToken(token: string) {
    return this.db
      .selectFrom('session')
      .innerJoin('user', 'user.id', 'session.userId')
      .where('session.token', '=', token)
      .select([
        'session.id',
        'session.expiresAt',
        'session.userId',
        'user.email',
        'user.name',
        'user.role',
        'user.avatarUrl',
      ])
      .executeTakeFirst();
  }
}
