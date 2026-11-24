import { AuthController } from 'src/controllers/auth.controller.js';
import { BlobController } from 'src/controllers/blob.controller.js';
import { BuildController } from 'src/controllers/build.controller.js';
import { DashboardController } from 'src/controllers/dashboard.controller.js';
import { GithubController } from 'src/controllers/github.controller.js';
import { ProjectController } from 'src/controllers/project.controller.js';
import { ReleaseController } from 'src/controllers/release.controller.js';
import { ScreenController } from 'src/controllers/screen.controller.js';
import { ScreenshotVersionController } from 'src/controllers/screenshot-version.controller.js';
import { ServerController } from 'src/controllers/server.controller.js';
import { UserController } from 'src/controllers/user.controller.js';

export const controllers = [
  AuthController,
  BlobController,
  BuildController,
  DashboardController,
  GithubController,
  ProjectController,
  ReleaseController,
  ScreenController,
  ScreenshotVersionController,
  ServerController,
  UserController,
];
