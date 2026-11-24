import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { ScreenController } from 'src/controllers/screen.controller.js';
import { ScreenService } from 'src/services/screen.service.js';
import { type ControllerContext, controllerSetup } from 'test/utils.js';

const projectId = '019a8f3e-7b2c-7d4e-9f1a-2b3c4d5e6f71';
const filter = { projectId, query: 'login' };
const invalid = [
  { name: 'projectId', value: 'unknown' },
  { name: 'query', value: ' ' },
];

describe(ScreenController.name, () => {
  let ctx: ControllerContext;
  const service = { search: vi.fn() };

  beforeAll(async () => {
    ctx = await controllerSetup(ScreenController, [{ provide: ScreenService, useValue: service }]);

    return () => ctx.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/screens', () => {
    it('requires a session', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status } = await request(ctx.getHttpServer()).get('/api/screens');

      expect(status).toBe(401);
      expect(service.search).not.toHaveBeenCalled();
    });

    it('passes the filters on', async () => {
      service.search.mockResolvedValue([]);

      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/screens')
        .query(filter)
        .set('cookie', 'squint_access_token=session-token');

      expect(status).toBe(200);
      expect(body).toEqual([]);
      expect(service.search).toHaveBeenCalledWith(filter);
    });

    it.each(invalid)('rejects $name set to "$value"', async ({ name, value }) => {
      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/screens')
        .query({ [name]: value });

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path: [name] })] });
      expect(service.search).not.toHaveBeenCalled();
    });
  });
});
