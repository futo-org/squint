import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { ServerController } from 'src/controllers/server.controller.js';
import { ServerService } from 'src/services/server.service.js';
import { type ControllerContext, controllerSetup } from 'test/utils.js';

describe(ServerController.name, () => {
  let ctx: ControllerContext;
  const service = { getAbout: vi.fn() };

  beforeAll(async () => {
    ctx = await controllerSetup(ServerController, [{ provide: ServerService, useValue: service }]);

    return () => ctx.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/server/ping', () => {
    it('answers without a session', async () => {
      const { status, body } = await request(ctx.getHttpServer()).get('/api/server/ping');

      expect(status).toBe(200);
      expect(body).toEqual({ res: 'pong' });
      expect(ctx.authenticate).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/server/about', () => {
    it('requires a session', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status } = await request(ctx.getHttpServer()).get('/api/server/about');

      expect(status).toBe(401);
      expect(service.getAbout).not.toHaveBeenCalled();
    });

    it('returns the build a signed in user is on', async () => {
      const about = {
        version: '0.1.0',
        repositoryUrl: 'https://github.com/futo-org/squint',
        commit: null,
        commitUrl: null,
        buildDate: new Date('2026-11-18T10:00:00Z'),
      };
      service.getAbout.mockReturnValue(about);

      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/server/about')
        .set('cookie', 'squint_access_token=session-token');

      expect(status).toBe(200);
      expect(body).toEqual({ ...about, buildDate: '2026-11-18T10:00:00.000Z' });
    });
  });
});
