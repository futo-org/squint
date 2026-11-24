import type { Kysely } from 'kysely';
import type { AuthDto, CiAuthDto } from 'src/dtos/auth.dto.js';
import type { BuildCreateDto } from 'src/dtos/build.dto.js';
import { ScreenshotTheme, UserRole } from 'src/enum.js';
import { ApprovalRepository } from 'src/repositories/approval.repository.js';
import { BlobRepository } from 'src/repositories/blob.repository.js';
import { BuildRepository } from 'src/repositories/build.repository.js';
import { CiRepository } from 'src/repositories/ci.repository.js';
import type { EnvData } from 'src/repositories/config.repository.js';
import { CryptoRepository } from 'src/repositories/crypto.repository.js';
import type { LoggingRepository } from 'src/repositories/logging.repository.js';
import { OAuthRepository } from 'src/repositories/oauth.repository.js';
import { ProjectRepository } from 'src/repositories/project.repository.js';
import { PullRequestRepository } from 'src/repositories/pull-request.repository.js';
import { ScreenshotVersionRepository } from 'src/repositories/screenshot-version.repository.js';
import { ScreenshotRepository } from 'src/repositories/screenshot.repository.js';
import { SessionRepository } from 'src/repositories/session.repository.js';
import { StorageRepository } from 'src/repositories/storage.repository.js';
import { UserRepository } from 'src/repositories/user.repository.js';
import { WebsocketRepository } from 'src/repositories/websocket.repository.js';
import type { DB } from 'src/schema/index.js';
import { AuthService } from 'src/services/auth.service.js';
import { BlobService } from 'src/services/blob.service.js';
import { BuildService } from 'src/services/build.service.js';
import { DashboardService } from 'src/services/dashboard.service.js';
import { GithubService } from 'src/services/github.service.js';
import { ProjectService } from 'src/services/project.service.js';
import { ScreenService } from 'src/services/screen.service.js';
import { ScreenshotVersionService } from 'src/services/screenshot-version.service.js';
import { TrashService } from 'src/services/trash.service.js';
import { ORIGIN, WEBHOOK_SECRET } from 'test/constants.js';
import type { GithubActions } from 'test/github-actions.js';
import type { IdentityProfile, IdentityProvider } from 'test/identity-provider.js';
import { newConfigRepository, newPng, newStorageEnv, sha256, signWebhook } from 'test/utils.js';

export type MediumContext = Awaited<ReturnType<typeof newMediumContext>>;

export const newMediumContext = async (db: Kysely<DB>, env: Partial<EnvData> = {}) => {
  const configRepository = newConfigRepository({ storage: await newStorageEnv(), ...env });
  const approvalRepository = new ApprovalRepository(db);
  const blobRepository = new BlobRepository(db);
  const buildRepository = new BuildRepository(db);
  const ciRepository = new CiRepository(configRepository);
  const cryptoRepository = new CryptoRepository();
  const loggingRepository = { log: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as LoggingRepository;
  const oauthRepository = new OAuthRepository(configRepository);
  const projectRepository = new ProjectRepository(db);
  const pullRequestRepository = new PullRequestRepository(db);
  const screenshotRepository = new ScreenshotRepository(db);
  const screenshotVersionRepository = new ScreenshotVersionRepository(db);
  const sessionRepository = new SessionRepository(db);
  const storageRepository = new StorageRepository(configRepository);
  const userRepository = new UserRepository(db);
  const websocketRepository = new WebsocketRepository();

  const authService = new AuthService(
    ciRepository,
    configRepository,
    cryptoRepository,
    oauthRepository,
    sessionRepository,
    userRepository,
  );
  const blobService = new BlobService(blobRepository, cryptoRepository, storageRepository);
  const buildService = new BuildService(
    approvalRepository,
    blobRepository,
    buildRepository,
    projectRepository,
    pullRequestRepository,
    screenshotRepository,
    screenshotVersionRepository,
    websocketRepository,
  );
  const githubService = new GithubService(
    buildRepository,
    configRepository,
    cryptoRepository,
    pullRequestRepository,
    websocketRepository,
  );
  const dashboardService = new DashboardService(screenshotVersionRepository);
  const screenService = new ScreenService(screenshotVersionRepository);
  const screenshotVersionService = new ScreenshotVersionService(screenshotVersionRepository);
  const projectService = new ProjectService(projectRepository);
  const trashService = new TrashService(
    blobRepository,
    buildRepository,
    loggingRepository,
    storageRepository,
    websocketRepository,
  );

  const signIn = async (idp: IdentityProvider, profile: IdentityProfile) => {
    const { url, loginState } = await authService.startLogin({ origin: ORIGIN });
    const { code, state } = idp.authorize(url, profile);
    const { token, returnTo } = await authService.finishLogin({
      url: `${ORIGIN}/api/auth/callback?code=${code}&state=${state}`,
      loginState,
    });

    return { token, returnTo, auth: await authService.authenticate(token) };
  };

  let userCount = 0;
  const newUser = async (
    overrides: Partial<{ name: string; email: string; role: UserRole }> = {},
  ): Promise<AuthDto> => {
    userCount++;
    const { id, email, name, role, avatarUrl } = await userRepository.upsert({
      oauthId: `user-${userCount}`,
      email: `user-${userCount}@immich.app`,
      name: `User ${userCount}`,
      role: UserRole.Approver,
      avatarUrl: null,
      ...overrides,
    });

    return { sessionId: `session-${userCount}`, user: { id, email, name, role, avatarUrl } };
  };

  const deliverWebhook = (event: string, payload: unknown, options: { secret?: string; signature?: string } = {}) => {
    const body = JSON.stringify(payload);
    const signature = options.signature ?? signWebhook(body, options.secret ?? WEBHOOK_SECRET);

    return githubService.handleWebhook({ event, signature, payload: body });
  };

  const signInCi = async (github: GithubActions, claims: Record<string, unknown> = {}) =>
    authService.authenticateCi(await github.token(claims));

  const uploadBlob = async (content: string) => {
    const png = newPng(content);
    const { sha256: hash } = await blobService.upload(sha256(png), png);

    return hash;
  };

  const publishBuild = async (auth: CiAuthDto, dto: BuildCreateDto, contents: Record<string, string>) => {
    const { id } = await buildService.create(auth, dto);
    const screenshots = [];
    for (const [key, content] of Object.entries(contents)) {
      const [name, theme = ScreenshotTheme.Light] = key.split('@', 2);
      screenshots.push({
        name,
        theme: theme as ScreenshotTheme,
        viewport: 'desktop',
        width: 1280,
        height: 720,
        sha256: await uploadBlob(content),
      });
    }

    await buildService.setScreenshots(auth, id, { screenshots });
    await buildService.complete(auth, id, { diffs: [] });

    return id;
  };

  return {
    db,
    approvalRepository,
    blobRepository,
    buildRepository,
    projectRepository,
    pullRequestRepository,
    screenshotRepository,
    sessionRepository,
    storageRepository,
    userRepository,
    websocketRepository,
    authService,
    blobService,
    buildService,
    dashboardService,
    githubService,
    projectService,
    screenService,
    screenshotVersionService,
    trashService,
    newUser,
    deliverWebhook,
    signIn,
    signInCi,
    uploadBlob,
    publishBuild,
  };
};
