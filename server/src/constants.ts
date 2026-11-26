import { createRequire } from 'node:module';
import { ReleaseNoteKind, UserRole } from 'src/enum.js';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_STATE_MAX_AGE_SECONDS = 5 * 60;

export const Constants = {
  App: {
    Version: (createRequire(import.meta.url)('../package.json') as { version: string }).version,
    RepositoryUrl: 'https://github.com/futo-org/squint',
  },
  Release: {
    NoteKinds: new Map([
      ['feat', ReleaseNoteKind.Feature],
      ['fix', ReleaseNoteKind.Fix],
      ['perf', ReleaseNoteKind.Fix],
    ]),
    ConventionalSubject: /^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/,
    VersionCommit: /^chore: version (\d+\.\d+\.\d+)(?: \(#\d+\))?$/,
    GitLogMaxBytes: 256 * 1024 * 1024,
    GitLogRecordSeparator: '\u{1E}',
  },
  Api: {
    Prefix: 'api',
    Title: 'Squint',
    Description: 'Squint API',
    Version: '1.0.0',
    SpecificationPath: '../open-api/squint-openapi-specs.json',
    JsonLimit: '10mb',
  },
  Cookies: {
    Session: {
      Name: 'squint_access_token',
      Options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE_SECONDS * 1000 },
    },
    OAuthState: {
      Name: 'squint_oauth_state',
      Options: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: OAUTH_STATE_MAX_AGE_SECONDS * 1000,
      },
    },
  },
  Websocket: {
    Path: '/api/socket.io',
    UnauthorizedMessage: 'Unauthorized',
  },
  Session: {
    MaxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    TokenBytes: 32,
  },
  Ci: {
    Audience: 'squint.futo.org',
    MainWorkflowSuffix: '@refs/heads/main',
    ReleaseWorkflowRef: /@refs\/tags\/[^@]+$/,
  },
  Blobs: {
    MaxBytes: 20 * 1024 * 1024,
    Folder: 'blobs',
    Extension: '.png',
    FanoutLength: 2,
    ContentType: 'image/png',
    UploadContentType: 'application/octet-stream',
    CacheControl: 'private, max-age=31536000, immutable',
    PngSignature: [137, 80, 78, 71, 13, 10, 26, 10],
    DeleteBatchSize: 1000,
    ReferenceColumns: ['sha256', 'baselineSha256', 'diffSha256'],
    ReferenceTables: ['screenshot', 'screenshot_version'],
  },
  Dashboard: {
    HistoryMs: 90 * 24 * 60 * 60 * 1000,
  },
  ScreenshotVersions: {
    PageSize: 500,
  },
  Screens: {
    PageSize: 5000,
  },
  Trash: {
    RetentionMs: 30 * 24 * 60 * 60 * 1000,
    UnreferencedGraceMs: 24 * 60 * 60 * 1000,
    IntervalMs: 60 * 60 * 1000,
  },
  Builds: {
    PageSize: 100,
    PullRequestQuery: /^#?(\d{1,9})$/,
    ReleasePattern: /^[\w.+-]{1,100}$/,
    MaxQueryLength: 200,
  },
  Github: {
    Url: 'https://github.com',
  },
  Database: {
    InsertBatchSize: 1000,
    BlobLockKey: 7_215_001,
    MigrationTable: 'kysely_migrations',
    MigrationLockTable: 'kysely_migrations_lock',
  },
  Screenshots: {
    MaxPerBuild: 5000,
    MaxDiffRegions: 50,
  },
  OAuth: {
    CallbackPath: '/api/auth/callback',
    Scope: 'openid email profile',
    Roles: [
      { claim: 'squint-approver', role: UserRole.Approver },
      { claim: 'squint-viewer', role: UserRole.Viewer },
    ],
  },
  Web: {
    ImmutablePath: '/_app/immutable',
    ImmutableCacheControl: 'public,max-age=31536000,immutable',
    IndexFile: 'index.html',
  },
} as const;
