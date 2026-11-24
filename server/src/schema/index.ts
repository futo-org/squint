import { Database } from '@immich/sql-tools';
import { ApprovalTable } from 'src/schema/tables/approval.table.js';
import { BlobTable } from 'src/schema/tables/blob.table.js';
import { BuildTable } from 'src/schema/tables/build.table.js';
import { ProjectTable } from 'src/schema/tables/project.table.js';
import { PullRequestTable } from 'src/schema/tables/pull-request.table.js';
import { ScreenshotVersionTable } from 'src/schema/tables/screenshot-version.table.js';
import { ScreenshotTable } from 'src/schema/tables/screenshot.table.js';
import { SessionTable } from 'src/schema/tables/session.table.js';
import { UserTable } from 'src/schema/tables/user.table.js';

@Database({ name: 'squint' })
export class SquintDatabase {
  tables = [
    ApprovalTable,
    BlobTable,
    BuildTable,
    ProjectTable,
    PullRequestTable,
    ScreenshotTable,
    ScreenshotVersionTable,
    SessionTable,
    UserTable,
  ];
}

export interface DB {
  approval: ApprovalTable;
  blob: BlobTable;
  build: BuildTable;
  project: ProjectTable;
  pull_request: PullRequestTable;
  screenshot: ScreenshotTable;
  screenshot_version: ScreenshotVersionTable;
  session: SessionTable;
  user: UserTable;
}
