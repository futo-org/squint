import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { ProjectController } from 'src/controllers/project.controller.js';
import { ProjectService } from 'src/services/project.service.js';
import { type ControllerContext, controllerSetup } from 'test/utils.js';

describe(ProjectController.name, () => {
  let ctx: ControllerContext;
  const service = { search: vi.fn() };

  beforeAll(async () => {
    ctx = await controllerSetup(ProjectController, [{ provide: ProjectService, useValue: service }]);

    return () => ctx.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/projects', () => {
    it('requires a session', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer()).get('/api/projects');

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticate).toHaveBeenCalledWith(undefined);
      expect(service.search).not.toHaveBeenCalled();
    });

    it('signs in with the session cookie', async () => {
      service.search.mockResolvedValue([]);

      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/projects')
        .set('cookie', 'squint_access_token=session-token');

      expect(status).toBe(200);
      expect(body).toEqual([]);
      expect(ctx.authenticate).toHaveBeenCalledWith('session-token');
      expect(ctx.authenticateCi).not.toHaveBeenCalled();
    });

    it('passes the search and filters on', async () => {
      service.search.mockResolvedValue([]);
      const id = '019a8f3e-7b2c-7d4e-9f1a-2b3c4d5e6f71';

      const { status } = await request(ctx.getHttpServer())
        .get('/api/projects')
        .query({ id, query: ' ui ', repository: 'immich-app/static-pages' });

      expect(status).toBe(200);
      expect(service.search).toHaveBeenCalledWith({ id, query: 'ui', repository: 'immich-app/static-pages' });
    });

    it.each([
      { name: 'id', value: 'unknown' },
      { name: 'query', value: ' ' },
      { name: 'repository', value: '' },
    ])('rejects $name set to "$value"', async ({ name, value }) => {
      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/projects')
        .query({ [name]: value });

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path: [name] })] });
      expect(service.search).not.toHaveBeenCalled();
    });
  });
});
