import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE TABLE "project" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "repository" character varying NOT NULL,
  "name" character varying NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "project_repository_name_uq" UNIQUE ("repository", "name"),
  CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);`.execute(db);
  await sql`CREATE TABLE "user" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "oauthId" character varying NOT NULL,
  "email" character varying NOT NULL,
  "name" character varying NOT NULL,
  "role" character varying NOT NULL,
  "avatarUrl" character varying,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_oauthId_uq" UNIQUE ("oauthId"),
  CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);`.execute(db);
  await sql`CREATE TABLE "approval" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "projectId" uuid NOT NULL,
  "name" character varying NOT NULL,
  "theme" character varying NOT NULL,
  "viewport" character varying NOT NULL,
  "baselineSha256" character varying,
  "sha256" character varying,
  "userId" uuid NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "approval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "approval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "approval_pkey" PRIMARY KEY ("id")
);`.execute(db);
  await sql`CREATE INDEX "approval_projectId_name_idx" ON "approval" ("projectId", "name");`.execute(db);
  await sql`CREATE INDEX "approval_userId_idx" ON "approval" ("userId");`.execute(db);
  await sql`CREATE TABLE "blob" (
  "sha256" character varying NOT NULL,
  "size" integer NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "blob_pkey" PRIMARY KEY ("sha256")
);`.execute(db);
  await sql`CREATE TABLE "build" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "projectId" uuid NOT NULL,
  "kind" character varying NOT NULL,
  "branch" character varying NOT NULL,
  "commit" character varying NOT NULL,
  "pullRequestNumber" integer,
  "release" character varying,
  "status" character varying NOT NULL DEFAULT 'pending',
  "baselineBuildId" uuid,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "completedAt" timestamp with time zone,
  "deletedAt" timestamp with time zone,
  CONSTRAINT "build_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "build_pkey" PRIMARY KEY ("id")
);`.execute(db);
  await sql`CREATE INDEX "build_projectId_createdAt_idx" ON "build" ("projectId", "createdAt");`.execute(db);
  await sql`CREATE INDEX "build_baselineBuildId_idx" ON "build" ("baselineBuildId");`.execute(db);
  await sql`ALTER TABLE "build" ADD CONSTRAINT "build_baselineBuildId_fkey" FOREIGN KEY ("baselineBuildId") REFERENCES "build" ("id") ON UPDATE CASCADE ON DELETE SET NULL;`.execute(
    db,
  );
  await sql`CREATE TABLE "pull_request" (
  "repository" character varying NOT NULL,
  "number" integer NOT NULL,
  "title" character varying,
  "state" character varying NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pull_request_pkey" PRIMARY KEY ("repository", "number")
);`.execute(db);
  await sql`CREATE TABLE "screenshot_version" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "projectId" uuid NOT NULL,
  "name" character varying NOT NULL,
  "theme" character varying NOT NULL,
  "viewport" character varying NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "status" character varying NOT NULL,
  "sha256" character varying,
  "baselineSha256" character varying,
  "diffSha256" character varying,
  "diffRatio" double precision,
  "diffRegions" jsonb,
  "commit" character varying NOT NULL,
  "createdAt" timestamp with time zone NOT NULL,
  CONSTRAINT "screenshot_version_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "screenshot_version_pkey" PRIMARY KEY ("id")
);`.execute(db);
  await sql`CREATE INDEX "screenshot_version_projectId_name_createdAt_idx" ON "screenshot_version" ("projectId", "name", "createdAt");`.execute(
    db,
  );
  await sql`CREATE TABLE "screenshot" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "buildId" uuid NOT NULL,
  "name" character varying NOT NULL,
  "theme" character varying NOT NULL,
  "viewport" character varying NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "status" character varying NOT NULL,
  "sha256" character varying,
  "baselineSha256" character varying,
  "diffSha256" character varying,
  "diffRatio" double precision,
  "diffRegions" jsonb,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "screenshot_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "build" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "screenshot_buildId_name_theme_viewport_uq" UNIQUE ("buildId", "name", "theme", "viewport"),
  CONSTRAINT "screenshot_pkey" PRIMARY KEY ("id")
);`.execute(db);
  await sql`CREATE TABLE "session" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "token" character varying NOT NULL,
  "userId" uuid NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "expiresAt" timestamp with time zone NOT NULL,
  CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "session_token_uq" UNIQUE ("token"),
  CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);`.execute(db);
  await sql`CREATE INDEX "session_userId_idx" ON "session" ("userId");`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "build" DROP CONSTRAINT "build_baselineBuildId_fkey";`.execute(db);
  await sql`DROP TABLE "approval";`.execute(db);
  await sql`DROP TABLE "screenshot";`.execute(db);
  await sql`DROP TABLE "build";`.execute(db);
  await sql`DROP TABLE "screenshot_version";`.execute(db);
  await sql`DROP TABLE "project";`.execute(db);
  await sql`DROP TABLE "session";`.execute(db);
  await sql`DROP TABLE "user";`.execute(db);
  await sql`DROP TABLE "blob";`.execute(db);
  await sql`DROP TABLE "pull_request";`.execute(db);
}
