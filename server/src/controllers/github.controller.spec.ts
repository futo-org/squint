import request from 'supertest';
import { GithubController } from 'src/controllers/github.controller.js';
import { GithubService } from 'src/services/github.service.js';
import { type ControllerContext, controllerSetup } from 'test/utils.js';

describe(GithubController.name, () => {
  let ctx: ControllerContext;
  const service = { handleWebhook: vi.fn() };

  beforeAll(async () => {
    ctx = await controllerSetup(GithubController, [{ provide: GithubService, useValue: service }]);

    return () => ctx.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/github/webhook', () => {
    it('is public', async () => {
      const { status, body } = await request(ctx.getHttpServer()).post('/api/github/webhook').send({});

      expect(status).toBe(204);
      expect(body).toEqual({});
      expect(ctx.authenticate).not.toHaveBeenCalled();
      expect(ctx.authenticateCi).not.toHaveBeenCalled();
    });

    it('passes the event, the signature and the raw body', async () => {
      const payload = '{ "zen":  "Keep it logically awesome." ,\n\t"hook_id":1 }\n';

      await request(ctx.getHttpServer())
        .post('/api/github/webhook')
        .set('content-type', 'application/json')
        .set('x-github-event', 'ping')
        .set('x-hub-signature-256', 'sha256=abc')
        .send(payload);

      expect(service.handleWebhook).toHaveBeenCalledWith({ event: 'ping', signature: 'sha256=abc', payload });
    });
  });
});
