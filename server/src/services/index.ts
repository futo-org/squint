import { AuthService } from 'src/services/auth.service.js';
import { BlobService } from 'src/services/blob.service.js';
import { BuildService } from 'src/services/build.service.js';
import { DashboardService } from 'src/services/dashboard.service.js';
import { DatabaseService } from 'src/services/database.service.js';
import { GithubService } from 'src/services/github.service.js';
import { ProjectService } from 'src/services/project.service.js';
import { ReleaseService } from 'src/services/release.service.js';
import { ScreenService } from 'src/services/screen.service.js';
import { ScreenshotVersionService } from 'src/services/screenshot-version.service.js';
import { ServerService } from 'src/services/server.service.js';
import { TrashService } from 'src/services/trash.service.js';

export const services = [
  AuthService,
  BlobService,
  BuildService,
  DashboardService,
  DatabaseService,
  GithubService,
  ProjectService,
  ReleaseService,
  ScreenService,
  ScreenshotVersionService,
  ServerService,
  TrashService,
];
