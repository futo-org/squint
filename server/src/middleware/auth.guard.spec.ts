import { UnauthorizedException } from '@nestjs/common';
import { Readable } from 'node:stream';
import request from 'supertest';
import { BlobController } from 'src/controllers/blob.controller.js';
import { BuildController } from 'src/controllers/build.controller.js';
import { ServerController } from 'src/controllers/server.controller.js';
import { UserController } from 'src/controllers/user.controller.js';
import { UserRole } from 'src/enum.js';
import { AuthGuard } from 'src/middleware/auth.guard.js';
import { BlobService } from 'src/services/blob.service.js';
import { BuildService } from 'src/services/build.service.js';
import { ServerService } from 'src/services/server.service.js';
import { type ControllerContext, controllerSetup, newCiAuth } from 'test/utils.js';

const sessionCookie = 'squint_access_token=session-token';
const build = { project: 'ui', kind: 'main', branch: 'main', commit: 'a'.repeat(40) };
const auth = {
  sessionId: 'session-1',
  user: {
    id: '3fe388e4-2078-44d7-b36c-39d9dee3a657',
    email: 'approver@immich.app',
    name: 'Approver',
    role: UserRole.Approver,
  },
};

describe(AuthGuard.name, () => {
  let ctx: ControllerContext;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('session route', () => {
    beforeAll(async () => {
      ctx = await controllerSetup(UserController);

      return () => ctx.close();
    });

    it('signs in with the session cookie and ignores a bearer token', async () => {
      ctx.authenticate.mockResolvedValue(auth);

      const { status } = await request(ctx.getHttpServer())
        .get('/api/users/me')
        .set('cookie', sessionCookie)
        .set('authorization', 'Bearer ci-token');

      expect(status).toBe(200);
      expect(ctx.authenticate).toHaveBeenCalledWith('session-token');
      expect(ctx.authenticateCi).not.toHaveBeenCalled();
    });
  });

  describe('CI route', () => {
    const service = { create: vi.fn() };

    beforeAll(async () => {
      ctx = await controllerSetup(BuildController, [{ provide: BuildService, useValue: service }]);

      return () => ctx.close();
    });

    it('signs in with the bearer token and ignores the session cookie', async () => {
      const ciAuth = newCiAuth();
      ctx.authenticateCi.mockResolvedValue(ciAuth);
      service.create.mockResolvedValue({ id: 'build-1' });

      const { status } = await request(ctx.getHttpServer())
        .post('/api/builds')
        .set('cookie', sessionCookie)
        .set('authorization', 'Bearer ci-token')
        .send(build);

      expect(status).toBe(201);
      expect(ctx.authenticateCi).toHaveBeenCalledWith('ci-token');
      expect(ctx.authenticate).not.toHaveBeenCalled();
      expect(service.create).toHaveBeenCalledWith(ciAuth, build);
    });

    it('requires a bearer token', async () => {
      ctx.authenticateCi.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer())
        .post('/api/builds')
        .set('cookie', sessionCookie)
        .send(build);

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticateCi).toHaveBeenCalledWith(undefined);
      expect(ctx.authenticate).not.toHaveBeenCalled();
      expect(service.create).not.toHaveBeenCalled();
    });

    it('does not read a token from another authorization scheme', async () => {
      await request(ctx.getHttpServer()).post('/api/builds').set('authorization', 'Basic ci-token').send(build);

      expect(ctx.authenticateCi).toHaveBeenCalledWith(undefined);
    });
  });

  describe('CI or session route', () => {
    const service = { download: vi.fn() };
    const path = `/api/blobs/${'a'.repeat(64)}`;

    beforeAll(async () => {
      ctx = await controllerSetup(BlobController, [{ provide: BlobService, useValue: service }]);

      return () => ctx.close();
    });

    it('signs in as CI when a bearer token is present', async () => {
      service.download.mockResolvedValue({ stream: Readable.from([Buffer.from('png')]), size: 3 });

      const { status } = await request(ctx.getHttpServer())
        .get(path)
        .set('cookie', sessionCookie)
        .set('authorization', 'Bearer ci-token');

      expect(status).toBe(200);
      expect(ctx.authenticateCi).toHaveBeenCalledWith('ci-token');
      expect(ctx.authenticate).not.toHaveBeenCalled();
    });

    it('signs in with the session cookie without a bearer token', async () => {
      service.download.mockResolvedValue({ stream: Readable.from([Buffer.from('png')]), size: 3 });

      const { status } = await request(ctx.getHttpServer()).get(path).set('cookie', sessionCookie);

      expect(status).toBe(200);
      expect(ctx.authenticate).toHaveBeenCalledWith('session-token');
      expect(ctx.authenticateCi).not.toHaveBeenCalled();
    });
  });

  describe('public route', () => {
    beforeAll(async () => {
      ctx = await controllerSetup(ServerController, [{ provide: ServerService, useValue: { getAbout: vi.fn() } }]);

      return () => ctx.close();
    });

    it('does not sign in', async () => {
      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/server/ping')
        .set('cookie', sessionCookie)
        .set('authorization', 'Bearer ci-token');

      expect(status).toBe(200);
      expect(body).toEqual({ res: 'pong' });
      expect(ctx.authenticate).not.toHaveBeenCalled();
      expect(ctx.authenticateCi).not.toHaveBeenCalled();
    });
  });
});
