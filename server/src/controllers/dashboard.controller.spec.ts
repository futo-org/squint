import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { DashboardController } from 'src/controllers/dashboard.controller.js';
import { DashboardService } from 'src/services/dashboard.service.js';
import { type ControllerContext, controllerSetup } from 'test/utils.js';

describe(DashboardController.name, () => {
  let ctx: ControllerContext;
  const service = { get: vi.fn() };

  beforeAll(async () => {
    ctx = await controllerSetup(DashboardController, [{ provide: DashboardService, useValue: service }]);

    return () => ctx.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/dashboard', () => {
    it('requires a session', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status } = await request(ctx.getHttpServer()).get('/api/dashboard');

      expect(status).toBe(401);
      expect(service.get).not.toHaveBeenCalled();
    });

    it('returns the history for a signed in user', async () => {
      const history = [{ projectId: '019a8f3e-7b2c-7d4e-9f1a-2b3c4d5e6f71', date: '2026-11-18', screenshotCount: 3 }];
      service.get.mockResolvedValue({ history });

      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/dashboard')
        .set('cookie', 'squint_access_token=session-token');

      expect(status).toBe(200);
      expect(body).toEqual({ history });
    });
  });
});
