import { Injectable } from '@nestjs/common';
import type { Insertable, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import type { DB } from 'src/schema/index.js';
import type { UserTable } from 'src/schema/tables/user.table.js';

@Injectable()
export class UserRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  upsert(user: Insertable<UserTable>) {
    return this.db
      .insertInto('user')
      .values(user)
      .onConflict((conflict) =>
        conflict.column('oauthId').doUpdateSet((eb) => ({
          email: eb.ref('excluded.email'),
          name: eb.ref('excluded.name'),
          role: eb.ref('excluded.role'),
          avatarUrl: eb.ref('excluded.avatarUrl'),
          updatedAt: eb.ref('excluded.updatedAt'),
        })),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
