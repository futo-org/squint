import { ApprovalRepository } from 'src/repositories/approval.repository.js';
import { BlobRepository } from 'src/repositories/blob.repository.js';
import { BuildRepository } from 'src/repositories/build.repository.js';
import { CiRepository } from 'src/repositories/ci.repository.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';
import { CryptoRepository } from 'src/repositories/crypto.repository.js';
import { DatabaseRepository } from 'src/repositories/database.repository.js';
import { ErrorReportingRepository } from 'src/repositories/error-reporting.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';
import { OAuthRepository } from 'src/repositories/oauth.repository.js';
import { ProjectRepository } from 'src/repositories/project.repository.js';
import { PullRequestRepository } from 'src/repositories/pull-request.repository.js';
import { ScreenshotVersionRepository } from 'src/repositories/screenshot-version.repository.js';
import { ScreenshotRepository } from 'src/repositories/screenshot.repository.js';
import { SessionRepository } from 'src/repositories/session.repository.js';
import { StorageRepository } from 'src/repositories/storage.repository.js';
import { UserRepository } from 'src/repositories/user.repository.js';
import { WebsocketRepository } from 'src/repositories/websocket.repository.js';

export const repositories = [
  ApprovalRepository,
  BlobRepository,
  BuildRepository,
  CiRepository,
  ConfigRepository,
  CryptoRepository,
  DatabaseRepository,
  ErrorReportingRepository,
  LoggingRepository,
  OAuthRepository,
  ProjectRepository,
  PullRequestRepository,
  ScreenshotRepository,
  ScreenshotVersionRepository,
  SessionRepository,
  StorageRepository,
  UserRepository,
  WebsocketRepository,
];
