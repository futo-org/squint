import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import request from 'supertest';
import { ServerController } from 'src/controllers/server.controller.js';
import { UserRole } from 'src/enum.js';
import { GlobalExceptionFilter } from 'src/middleware/global-exception.filter.js';
import { ServerService } from 'src/services/server.service.js';
import { type ControllerContext, controllerSetup } from 'test/utils.js';

const auth = {
  sessionId: 'session-1',
  user: {
    id: '3fe388e4-2078-44d7-b36c-39d9dee3a657',
    email: 'viewer@immich.app',
    name: 'Viewer',
    role: UserRole.Viewer,
  },
};

describe(GlobalExceptionFilter.name, () => {
  const service = { getAbout: vi.fn() };
  const reported: Sentry.ErrorEvent[] = [];
  let ctx: ControllerContext;

  beforeAll(async () => {
    Sentry.init({
      dsn: 'https://key@sentry.invalid/1',
      defaultIntegrations: false,
      beforeSend: (event) => {
        reported.push(event);
        return null;
      },
    });
    ctx = await controllerSetup(ServerController, [{ provide: ServerService, useValue: service }]);

    return async () => {
      await ctx.close();
      await Sentry.close();
    };
  });

  beforeEach(() => {
    vi.resetAllMocks();
    reported.length = 0;
    ctx.authenticate.mockResolvedValue(auth);
  });

  it('reports an unexpected error', async () => {
    const error = new Error('Database is down');
    service.getAbout.mockImplementation(() => {
      throw error;
    });

    const { status, body } = await request(ctx.getHttpServer())
      .get('/api/server/about')
      .set('cookie', 'squint_access_token=session-token');

    expect(status).toBe(500);
    expect(body).toEqual({ message: 'Internal server error' });
    await Sentry.flush();
    expect(reported).toMatchObject([
      { exception: { values: [{ value: 'Database is down', mechanism: { handled: false } }] } },
    ]);
  });

  it.each([
    { error: new BadRequestException(), status: 400 },
    { error: new UnauthorizedException(), status: 401 },
    { error: new NotFoundException(), status: 404 },
  ])('does not report a $status', async ({ error, status }) => {
    service.getAbout.mockImplementation(() => {
      throw error;
    });

    const response = await request(ctx.getHttpServer())
      .get('/api/server/about')
      .set('cookie', 'squint_access_token=session-token');

    expect(response.status).toBe(status);
    await Sentry.flush();
    expect(reported).toEqual([]);
  });
});
