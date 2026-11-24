import { UnauthorizedException } from '@nestjs/common';
import { Readable } from 'node:stream';
import request from 'supertest';
import { BlobController } from 'src/controllers/blob.controller.js';
import { BlobService } from 'src/services/blob.service.js';
import { type ControllerContext, controllerSetup, newPng, sha256 } from 'test/utils.js';

describe(BlobController.name, () => {
  let ctx: ControllerContext;
  const service = { upload: vi.fn(), download: vi.fn() };

  const png = Buffer.from(newPng('button'));
  const hash = sha256(png);

  beforeAll(async () => {
    ctx = await controllerSetup(BlobController, [{ provide: BlobService, useValue: service }]);

    return () => ctx.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('PUT /api/blobs/:sha256', () => {
    it('requires a CI token', async () => {
      ctx.authenticateCi.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer())
        .put(`/api/blobs/${hash}`)
        .set('cookie', 'squint_access_token=session-token')
        .set('content-type', 'application/octet-stream')
        .send(png);

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticateCi).toHaveBeenCalledWith(undefined);
      expect(ctx.authenticate).not.toHaveBeenCalled();
      expect(service.upload).not.toHaveBeenCalled();
    });

    it('rejects a hash that is not a sha256', async () => {
      const { status, body } = await request(ctx.getHttpServer())
        .put('/api/blobs/not-a-hash')
        .set('authorization', 'Bearer ci-token')
        .set('content-type', 'application/octet-stream')
        .send(png);

      expect(status).toBe(400);
      expect(body).toMatchObject({ message: 'Validation failed' });
      expect(service.upload).not.toHaveBeenCalled();
    });

    it.each(['application/octet-stream', 'image/png'])('passes the bytes sent as %s', async (contentType) => {
      service.upload.mockResolvedValue({ sha256: hash });

      const { status, body } = await request(ctx.getHttpServer())
        .put(`/api/blobs/${hash}`)
        .set('authorization', 'Bearer ci-token')
        .set('content-type', contentType)
        .send(png);

      expect(status).toBe(200);
      expect(body).toEqual({ sha256: hash });
      expect(ctx.authenticateCi).toHaveBeenCalledWith('ci-token');
      expect(service.upload).toHaveBeenCalledWith(hash, png);
    });

    it('passes an empty buffer when there is no body', async () => {
      service.upload.mockResolvedValue({ sha256: hash });

      await request(ctx.getHttpServer()).put(`/api/blobs/${hash}`).set('authorization', 'Bearer ci-token');

      expect(service.upload).toHaveBeenCalledWith(hash, Buffer.alloc(0));
    });
  });

  describe('GET /api/blobs/:sha256', () => {
    it('requires a session or a CI token', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer()).get(`/api/blobs/${hash}`);

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticate).toHaveBeenCalledWith(undefined);
      expect(ctx.authenticateCi).not.toHaveBeenCalled();
      expect(service.download).not.toHaveBeenCalled();
    });

    it('signs in with the CI token when one is sent', async () => {
      service.download.mockResolvedValue({ stream: Readable.from([png]), size: 14 });

      const { status } = await request(ctx.getHttpServer())
        .get(`/api/blobs/${hash}`)
        .set('authorization', 'Bearer ci-token');

      expect(status).toBe(200);
      expect(ctx.authenticateCi).toHaveBeenCalledWith('ci-token');
      expect(ctx.authenticate).not.toHaveBeenCalled();
    });

    it('streams the screenshot as an immutable png', async () => {
      service.download.mockResolvedValue({ stream: Readable.from([png]), size: 14 });

      const { status, headers, body } = await request(ctx.getHttpServer())
        .get(`/api/blobs/${hash}`)
        .set('cookie', 'squint_access_token=session-token');

      expect(status).toBe(200);
      expect(headers).toMatchObject({
        'content-type': 'image/png',
        'content-length': '14',
        'cache-control': 'private, max-age=31536000, immutable',
      });
      expect(body).toEqual(png);
      expect(ctx.authenticate).toHaveBeenCalledWith('session-token');
      expect(service.download).toHaveBeenCalledWith(hash);
    });
  });
});
