import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { UserController } from 'src/controllers/user.controller.js';
import { UserRole } from 'src/enum.js';
import { type ControllerContext, controllerSetup } from 'test/utils.js';

describe(UserController.name, () => {
  let ctx: ControllerContext;

  beforeAll(async () => {
    ctx = await controllerSetup(UserController);

    return () => ctx.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/users/me', () => {
    it('requires a session', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer()).get('/api/users/me');

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticate).toHaveBeenCalledWith(undefined);
    });

    it('returns the signed in user', async () => {
      ctx.authenticate.mockResolvedValue({
        sessionId: 'session-1',
        user: {
          id: '3fe388e4-2078-44d7-b36c-39d9dee3a657',
          email: 'approver@immich.app',
          name: 'Approver',
          role: UserRole.Approver,
        },
      });

      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/users/me')
        .set('cookie', 'squint_access_token=session-token');

      expect(status).toBe(200);
      expect(body).toEqual({
        id: '3fe388e4-2078-44d7-b36c-39d9dee3a657',
        email: 'approver@immich.app',
        name: 'Approver',
        role: 'approver',
      });
    });
  });
});
