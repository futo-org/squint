import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { ReleaseController } from 'src/controllers/release.controller.js';
import { ReleaseService } from 'src/services/release.service.js';
import { type ControllerContext, controllerSetup } from 'test/utils.js';

describe(ReleaseController.name, () => {
  let ctx: ControllerContext;
  const service = { search: vi.fn() };

  beforeAll(async () => {
    ctx = await controllerSetup(ReleaseController, [{ provide: ReleaseService, useValue: service }]);

    return () => ctx.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/releases', () => {
    it('requires a session', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status } = await request(ctx.getHttpServer()).get('/api/releases');

      expect(status).toBe(401);
      expect(service.search).not.toHaveBeenCalled();
    });

    it('lists the releases for a signed in user', async () => {
      const release = { version: '0.1.0', notes: [{ kind: 'feature', text: 'Review inbox' }] };
      service.search.mockReturnValue([{ ...release, date: new Date('2026-11-18T10:00:00Z') }]);

      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/releases')
        .set('cookie', 'squint_access_token=session-token');

      expect(status).toBe(200);
      expect(body).toEqual([{ ...release, date: '2026-11-18T10:00:00.000Z' }]);
    });
  });
});
