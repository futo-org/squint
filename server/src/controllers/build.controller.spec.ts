import { UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { BuildController } from 'src/controllers/build.controller.js';
import { UserRole } from 'src/enum.js';
import { BuildService } from 'src/services/build.service.js';
import { type ControllerContext, controllerSetup, newCiAuth } from 'test/utils.js';

const buildId = '019a8f3e-7b2c-7d4e-9f1a-2b3c4d5e6f70';
const projectId = '019a8f3e-7b2c-7d4e-9f1a-2b3c4d5e6f71';
const screenshotId = '019a8f3e-7b2c-7d4e-9f1a-2b3c4d5e6f72';
const main = { project: 'ui', kind: 'main', branch: 'main', commit: 'a'.repeat(40) };
const pullRequest = {
  project: 'ui',
  kind: 'pull-request',
  branch: 'feat/x',
  commit: 'b'.repeat(40),
  pullRequestNumber: 7,
};
const screenshot = {
  name: 'button',
  theme: 'light',
  viewport: 'desktop',
  width: 1280,
  height: 720,
  sha256: 'c'.repeat(64),
};
const region = { x: 12, y: 40, width: 96, height: 32 };
const diff = { screenshotId, sha256: 'd'.repeat(64), ratio: 0.0267, regions: [region] };
const ciAuth = newCiAuth();
const userAuth = {
  sessionId: 'session-1',
  user: {
    id: '019a8f3e-7b2c-7d4e-9f1a-2b3c4d5e6f73',
    email: 'a@immich.app',
    name: 'Approver',
    role: UserRole.Approver,
  },
};

describe(BuildController.name, () => {
  let ctx: ControllerContext;
  const service = {
    create: vi.fn(),
    search: vi.fn(),
    get: vi.fn(),
    setScreenshots: vi.fn(),
    complete: vi.fn(),
    approve: vi.fn(),
    revoke: vi.fn(),
  };

  beforeAll(async () => {
    ctx = await controllerSetup(BuildController, [{ provide: BuildService, useValue: service }]);

    return () => ctx.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/builds', () => {
    it('requires a token', async () => {
      ctx.authenticateCi.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer()).post('/api/builds').send(main);

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticateCi).toHaveBeenCalledWith(undefined);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('creates the build for the CI caller', async () => {
      ctx.authenticateCi.mockResolvedValue(ciAuth);
      service.create.mockResolvedValue({ id: buildId });

      const { status, body } = await request(ctx.getHttpServer())
        .post('/api/builds')
        .set('authorization', 'Bearer ci-token')
        .send(pullRequest);

      expect(status).toBe(201);
      expect(body).toEqual({ id: buildId });
      expect(ctx.authenticateCi).toHaveBeenCalledWith('ci-token');
      expect(ctx.authenticate).not.toHaveBeenCalled();
      expect(service.create).toHaveBeenCalledWith(ciAuth, pullRequest);
    });

    it.each([
      [
        'a pull request build without a number',
        { ...pullRequest, pullRequestNumber: undefined },
        ['pullRequestNumber'],
      ],
      ['a main build with a pull request number', { ...main, pullRequestNumber: 7 }, ['pullRequestNumber']],
      ['a commit that is not a full sha', { ...main, commit: '4c8ec15' }, ['commit']],
      ['an unknown kind', { ...main, kind: 'nightly' }, ['kind']],
      ['a project name with a slash', { ...main, project: 'ui/docs' }, ['project']],
      ['an unknown field', { ...main, tag: 'v1' }, []],
    ])('rejects %s', async (_name, dto, path) => {
      const { status, body } = await request(ctx.getHttpServer()).post('/api/builds').send(dto);

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path })] });
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/builds release', () => {
    const release = { project: 'ui', kind: 'release', branch: 'main', commit: 'a'.repeat(40), release: 'v2.3.0' };

    it('passes a release build on', async () => {
      ctx.authenticateCi.mockResolvedValue(ciAuth);
      service.create.mockResolvedValue({ id: buildId });

      const { status } = await request(ctx.getHttpServer())
        .post('/api/builds')
        .set('authorization', 'Bearer ci-token')
        .send(release);

      expect(status).toBe(201);
      expect(service.create).toHaveBeenCalledWith(ciAuth, release);
    });

    it.each([
      { title: 'a release without a name', body: { ...release, release: undefined }, path: 'release' },
      { title: 'a release with a pull request', body: { ...release, pullRequestNumber: 7 }, path: 'pullRequestNumber' },
      { title: 'a main build with a release name', body: { ...main, release: 'v2.3.0' }, path: 'release' },
      { title: 'a release name with spaces', body: { ...release, release: 'v2 final' }, path: 'release' },
      { title: 'a release name that is too long', body: { ...release, release: 'v'.repeat(101) }, path: 'release' },
    ])('rejects $title', async ({ body, path }) => {
      ctx.authenticateCi.mockResolvedValue(ciAuth);

      const response = await request(ctx.getHttpServer())
        .post('/api/builds')
        .set('authorization', 'Bearer ci-token')
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: [path] })]));
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/builds', () => {
    it('requires a session', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer()).get('/api/builds');

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticate).toHaveBeenCalledWith(undefined);
      expect(service.search).not.toHaveBeenCalled();
    });

    it('searches the builds of the requested project', async () => {
      service.search.mockResolvedValue([{ id: buildId }]);

      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/builds')
        .query({ projectId })
        .set('cookie', 'squint_access_token=session-token');

      expect(status).toBe(200);
      expect(body).toEqual([{ id: buildId }]);
      expect(ctx.authenticate).toHaveBeenCalledWith('session-token');
      expect(ctx.authenticateCi).not.toHaveBeenCalled();
      expect(service.search).toHaveBeenCalledWith({ projectId });
    });

    it('rejects a project id that is not a UUID', async () => {
      const { status, body } = await request(ctx.getHttpServer()).get('/api/builds').query({ projectId: 'unknown' });

      expect(status).toBe(400);
      expect(body).toEqual({
        message: 'Validation failed',
        errors: [expect.objectContaining({ path: ['projectId'] })],
      });
      expect(service.search).not.toHaveBeenCalled();
    });

    it('passes the search and every filter on', async () => {
      service.search.mockResolvedValue([]);
      const filter = {
        id: buildId,
        kind: 'pull-request',
        status: 'complete',
        pullRequestState: 'open',
        branch: 'feat/x',
        review: 'needs-review',
      };

      const { status } = await request(ctx.getHttpServer())
        .get('/api/builds')
        .query({ ...filter, query: '  button radius ', isTrashed: 'true' });

      expect(status).toBe(200);
      expect(service.search).toHaveBeenCalledWith({ ...filter, query: 'button radius', isTrashed: true });
    });

    it.each([
      { name: 'id', value: 'unknown' },
      { name: 'kind', value: 'nightly' },
      { name: 'status', value: 'done' },
      { name: 'pullRequestState', value: 'draft' },
      { name: 'review', value: 'rejected' },
      { name: 'branch', value: '' },
      { name: 'isTrashed', value: 'yes' },
      { name: 'query', value: ' '.repeat(3) },
      { name: 'query', value: 'x'.repeat(201) },
    ])('rejects $name set to "$value"', async ({ name, value }) => {
      const { status, body } = await request(ctx.getHttpServer())
        .get('/api/builds')
        .query({ [name]: value });

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path: [name] })] });
      expect(service.search).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/builds/:id', () => {
    it('requires a session', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer()).get(`/api/builds/${buildId}`);

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticate).toHaveBeenCalledWith(undefined);
      expect(service.get).not.toHaveBeenCalled();
    });

    it('returns the build', async () => {
      service.get.mockResolvedValue({ id: buildId, screenshots: [] });

      const { status, body } = await request(ctx.getHttpServer())
        .get(`/api/builds/${buildId}`)
        .set('cookie', 'squint_access_token=session-token');

      expect(status).toBe(200);
      expect(body).toEqual({ id: buildId, screenshots: [] });
      expect(ctx.authenticate).toHaveBeenCalledWith('session-token');
      expect(ctx.authenticateCi).not.toHaveBeenCalled();
      expect(service.get).toHaveBeenCalledWith(buildId);
    });

    it('rejects an id that is not a UUID', async () => {
      const { status, body } = await request(ctx.getHttpServer()).get('/api/builds/unknown');

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path: ['id'] })] });
      expect(service.get).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/builds/:id/screenshots', () => {
    it('requires a token', async () => {
      ctx.authenticateCi.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer())
        .put(`/api/builds/${buildId}/screenshots`)
        .send({ screenshots: [] });

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticateCi).toHaveBeenCalledWith(undefined);
      expect(service.setScreenshots).not.toHaveBeenCalled();
    });

    it('publishes the screenshots for the CI caller', async () => {
      ctx.authenticateCi.mockResolvedValue(ciAuth);
      service.setScreenshots.mockResolvedValue({ baselineBuildId: null, screenshots: [], missing: [] });

      const { status, body } = await request(ctx.getHttpServer())
        .put(`/api/builds/${buildId}/screenshots`)
        .set('authorization', 'Bearer ci-token')
        .send({ screenshots: [screenshot] });

      expect(status).toBe(200);
      expect(body).toEqual({ baselineBuildId: null, screenshots: [], missing: [] });
      expect(ctx.authenticateCi).toHaveBeenCalledWith('ci-token');
      expect(ctx.authenticate).not.toHaveBeenCalled();
      expect(service.setScreenshots).toHaveBeenCalledWith(ciAuth, buildId, { screenshots: [screenshot] });
    });

    it.each([
      ['an unknown theme', { theme: 'sepia' }, 'theme'],
      ['a hash that is not a sha256', { sha256: 'abc' }, 'sha256'],
      ['a viewport name with spaces', { viewport: 'big screen' }, 'viewport'],
      ['a width of zero', { width: 0 }, 'width'],
    ])('rejects %s', async (_name, overrides, field) => {
      const { status, body } = await request(ctx.getHttpServer())
        .put(`/api/builds/${buildId}/screenshots`)
        .send({ screenshots: [{ ...screenshot, ...overrides }] });

      expect(status).toBe(400);
      expect(body).toEqual({
        message: 'Validation failed',
        errors: [expect.objectContaining({ path: ['screenshots', 0, field] })],
      });
      expect(service.setScreenshots).not.toHaveBeenCalled();
    });

    it('rejects an id that is not a UUID', async () => {
      const { status, body } = await request(ctx.getHttpServer())
        .put('/api/builds/unknown/screenshots')
        .send({ screenshots: [] });

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path: ['id'] })] });
      expect(service.setScreenshots).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/builds/:id/complete', () => {
    it('requires a token', async () => {
      ctx.authenticateCi.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer())
        .post(`/api/builds/${buildId}/complete`)
        .send({ diffs: [] });

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticateCi).toHaveBeenCalledWith(undefined);
      expect(service.complete).not.toHaveBeenCalled();
    });

    it('completes the build for the CI caller', async () => {
      ctx.authenticateCi.mockResolvedValue(ciAuth);
      service.complete.mockResolvedValue({ id: buildId, status: 'complete' });

      const { status, body } = await request(ctx.getHttpServer())
        .post(`/api/builds/${buildId}/complete`)
        .set('authorization', 'Bearer ci-token')
        .send({ diffs: [diff] });

      expect(status).toBe(200);
      expect(body).toEqual({ id: buildId, status: 'complete' });
      expect(ctx.authenticateCi).toHaveBeenCalledWith('ci-token');
      expect(ctx.authenticate).not.toHaveBeenCalled();
      expect(service.complete).toHaveBeenCalledWith(ciAuth, buildId, { diffs: [diff] });
    });

    it.each([
      ['a region off the image', { regions: [{ ...region, x: -1 }] }, ['regions', 0, 'x']],
      ['an empty region', { regions: [{ ...region, width: 0 }] }, ['regions', 0, 'width']],
      ['a region between pixels', { regions: [{ ...region, x: 0.5 }] }, ['regions', 0, 'x']],
      ['more than 50 regions', { regions: Array.from({ length: 51 }, () => region) }, ['regions']],
      ['a diff without regions', { regions: undefined }, ['regions']],
      ['a screenshot id that is not a UUID', { screenshotId: 'unknown' }, ['screenshotId']],
    ])('rejects %s', async (_name, overrides, path) => {
      const { status, body } = await request(ctx.getHttpServer())
        .post(`/api/builds/${buildId}/complete`)
        .send({ diffs: [{ ...diff, ...overrides }] });

      expect(status).toBe(400);
      expect(body).toEqual({
        message: 'Validation failed',
        errors: [expect.objectContaining({ path: ['diffs', 0, ...path] })],
      });
      expect(service.complete).not.toHaveBeenCalled();
    });

    it('accepts 50 regions', async () => {
      const regions = Array.from({ length: 50 }, () => region);

      const { status } = await request(ctx.getHttpServer())
        .post(`/api/builds/${buildId}/complete`)
        .send({ diffs: [{ ...diff, regions }] });

      expect(status).toBe(200);
      expect(service.complete).toHaveBeenCalledOnce();
    });

    it('rejects an id that is not a UUID', async () => {
      const { status, body } = await request(ctx.getHttpServer())
        .post('/api/builds/unknown/complete')
        .send({ diffs: [] });

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path: ['id'] })] });
      expect(service.complete).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/builds/:id/approval', () => {
    it('requires a session', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer())
        .put(`/api/builds/${buildId}/approval`)
        .send({ name: 'button' });

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticate).toHaveBeenCalledWith(undefined);
      expect(service.approve).not.toHaveBeenCalled();
    });

    it('approves the screen as the signed in user', async () => {
      ctx.authenticate.mockResolvedValue(userAuth);

      const { status, text } = await request(ctx.getHttpServer())
        .put(`/api/builds/${buildId}/approval`)
        .set('cookie', 'squint_access_token=session-token')
        .send({ name: 'button' });

      expect(status).toBe(204);
      expect(text).toBe('');
      expect(ctx.authenticate).toHaveBeenCalledWith('session-token');
      expect(ctx.authenticateCi).not.toHaveBeenCalled();
      expect(service.approve).toHaveBeenCalledWith(userAuth, buildId, { name: 'button' });
    });

    it('rejects a body without a name', async () => {
      const { status, body } = await request(ctx.getHttpServer()).put(`/api/builds/${buildId}/approval`).send({});

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path: ['name'] })] });
      expect(service.approve).not.toHaveBeenCalled();
    });

    it('rejects an id that is not a UUID', async () => {
      const { status, body } = await request(ctx.getHttpServer())
        .put('/api/builds/unknown/approval')
        .send({ name: 'button' });

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path: ['id'] })] });
      expect(service.approve).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/builds/:id/approval', () => {
    it('requires a session', async () => {
      ctx.authenticate.mockRejectedValue(new UnauthorizedException());

      const { status, body } = await request(ctx.getHttpServer())
        .delete(`/api/builds/${buildId}/approval`)
        .query({ name: 'button' });

      expect(status).toBe(401);
      expect(body).toEqual({ message: 'Unauthorized' });
      expect(ctx.authenticate).toHaveBeenCalledWith(undefined);
      expect(service.revoke).not.toHaveBeenCalled();
    });

    it('revokes the approval as the signed in user', async () => {
      ctx.authenticate.mockResolvedValue(userAuth);

      const { status, text } = await request(ctx.getHttpServer())
        .delete(`/api/builds/${buildId}/approval`)
        .query({ name: 'button' })
        .set('cookie', 'squint_access_token=session-token');

      expect(status).toBe(204);
      expect(text).toBe('');
      expect(ctx.authenticate).toHaveBeenCalledWith('session-token');
      expect(ctx.authenticateCi).not.toHaveBeenCalled();
      expect(service.revoke).toHaveBeenCalledWith(userAuth, buildId, { name: 'button' });
    });

    it('rejects a query without a name', async () => {
      const { status, body } = await request(ctx.getHttpServer()).delete(`/api/builds/${buildId}/approval`);

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path: ['name'] })] });
      expect(service.revoke).not.toHaveBeenCalled();
    });

    it('rejects an id that is not a UUID', async () => {
      const { status, body } = await request(ctx.getHttpServer())
        .delete('/api/builds/unknown/approval')
        .query({ name: 'button' });

      expect(status).toBe(400);
      expect(body).toEqual({ message: 'Validation failed', errors: [expect.objectContaining({ path: ['id'] })] });
      expect(service.revoke).not.toHaveBeenCalled();
    });
  });
});
