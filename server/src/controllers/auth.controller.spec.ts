import { BadRequestException } from '@nestjs/common';
import request, { type Response } from 'supertest';
import { AuthController } from 'src/controllers/auth.controller.js';
import { AuthService } from 'src/services/auth.service.js';
import { type ControllerContext, controllerSetup } from 'test/utils.js';

const loginState = {
  state: 'state-1',
  nonce: 'nonce-1',
  codeVerifier: 'verifier-1',
  returnTo: 'https://squint.futo.org/',
};

const getSetCookies = (response: Response) =>
  Object.fromEntries(
    (response.get('Set-Cookie') ?? []).map((cookie) => {
      const [pair, ...attributes] = cookie.split('; ');
      const [name, value] = pair.split('=', 2);

      return [name, { value, pair, attributes: new Set(attributes) }];
    }),
  );

describe(AuthController.name, () => {
  let ctx: ControllerContext;
  const service = { startLogin: vi.fn(), finishLogin: vi.fn() };

  const startLogin = async () => {
    service.startLogin.mockResolvedValue({ url: 'https://idp.test/oauth/v2/authorize?state=state-1', loginState });
    const response = await request(ctx.getHttpServer()).get('/api/auth/login');

    return { stateCookie: getSetCookies(response).squint_oauth_state.pair };
  };

  beforeAll(async () => {
    ctx = await controllerSetup(AuthController, [{ provide: AuthService, useValue: service }]);

    return () => ctx.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GET /api/auth/login', () => {
    it('redirects to the identity provider', async () => {
      service.startLogin.mockResolvedValue({ url: 'https://idp.test/oauth/v2/authorize?state=state-1', loginState });

      const { status, headers } = await request(ctx.getHttpServer()).get('/api/auth/login');

      expect(status).toBe(302);
      expect(headers.location).toBe('https://idp.test/oauth/v2/authorize?state=state-1');
    });

    it('starts the login for the site and page of the request', async () => {
      service.startLogin.mockResolvedValue({ url: 'https://idp.test/oauth/v2/authorize?state=state-1', loginState });

      await request(ctx.getHttpServer())
        .get('/api/auth/login?returnTo=%2Fbuilds%3Fpage%3D2')
        .set('host', 'squint.futo.org')
        .set('x-forwarded-proto', 'https');

      expect(service.startLogin).toHaveBeenCalledWith({
        origin: 'https://squint.futo.org',
        returnTo: '/builds?page=2',
      });
    });

    it('uses the host a trusted proxy forwards', async () => {
      service.startLogin.mockResolvedValue({ url: 'https://idp.test/oauth/v2/authorize?state=state-1', loginState });

      await request(ctx.getHttpServer())
        .get('/api/auth/login')
        .set('host', 'squint-server:3000')
        .set('x-forwarded-host', 'squint.futo.org')
        .set('x-forwarded-proto', 'https');

      expect(service.startLogin).toHaveBeenCalledWith({ origin: 'https://squint.futo.org', returnTo: undefined });
    });

    it('keeps the login state in an http only cookie', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T00:00:00Z') });
      service.startLogin.mockResolvedValue({ url: 'https://idp.test/oauth/v2/authorize?state=state-1', loginState });

      const response = await request(ctx.getHttpServer()).get('/api/auth/login');

      expect(getSetCookies(response).squint_oauth_state.attributes).toEqual(
        new Set([
          'Path=/api/auth',
          'HttpOnly',
          'Secure',
          'SameSite=Lax',
          'Max-Age=300',
          'Expires=Sun, 01 Nov 2026 00:05:00 GMT',
        ]),
      );
    });
  });

  describe('GET /api/auth/callback', () => {
    it.each(['state=abc', 'code=abc', 'code=&state=abc'])(
      'rejects a callback with an incomplete query (%s)',
      async (query) => {
        const { status, body } = await request(ctx.getHttpServer()).get(`/api/auth/callback?${query}`);

        expect(status).toBe(400);
        expect(body).toMatchObject({ message: 'Validation failed' });
        expect(service.finishLogin).not.toHaveBeenCalled();
      },
    );

    it('lists the fields that failed validation', async () => {
      const { body } = await request(ctx.getHttpServer()).get('/api/auth/callback?state=abc');

      expect(body).toEqual({
        message: 'Validation failed',
        errors: [expect.objectContaining({ code: 'invalid_type', path: ['code'], message: expect.any(String) })],
      });
    });

    it('finishes the login with the request URL and the login state', async () => {
      const { stateCookie } = await startLogin();
      service.finishLogin.mockResolvedValue({ token: 'session-token', returnTo: 'https://squint.futo.org/' });

      await request(ctx.getHttpServer())
        .get('/api/auth/callback?code=code-1&state=state-1')
        .set('host', 'squint.futo.org')
        .set('x-forwarded-proto', 'https')
        .set('cookie', stateCookie);

      expect(service.finishLogin).toHaveBeenCalledWith({
        url: 'https://squint.futo.org/api/auth/callback?code=code-1&state=state-1',
        loginState: {
          state: 'state-1',
          nonce: 'nonce-1',
          codeVerifier: 'verifier-1',
          returnTo: 'https://squint.futo.org/',
        },
      });
    });

    it('redirects to the return page', async () => {
      service.finishLogin.mockResolvedValue({
        token: 'session-token',
        returnTo: 'https://squint.futo.org/builds?page=2',
      });

      const { status, headers } = await request(ctx.getHttpServer()).get(
        '/api/auth/callback?code=code-1&state=state-1',
      );

      expect(status).toBe(302);
      expect(headers.location).toBe('https://squint.futo.org/builds?page=2');
    });

    it('keeps the session in an http only cookie for 7 days', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T00:00:00Z') });
      service.finishLogin.mockResolvedValue({ token: 'session-token', returnTo: 'https://squint.futo.org/' });

      const response = await request(ctx.getHttpServer()).get('/api/auth/callback?code=code-1&state=state-1');

      const { value, attributes } = getSetCookies(response).squint_access_token;
      expect(value).toBe('session-token');
      expect(attributes).toEqual(
        new Set([
          'Path=/',
          'HttpOnly',
          'Secure',
          'SameSite=Lax',
          'Max-Age=604800',
          'Expires=Sun, 08 Nov 2026 00:00:00 GMT',
        ]),
      );
    });

    it('clears the login state cookie', async () => {
      service.finishLogin.mockResolvedValue({ token: 'session-token', returnTo: 'https://squint.futo.org/' });

      const response = await request(ctx.getHttpServer()).get('/api/auth/callback?code=code-1&state=state-1');

      const { value, attributes } = getSetCookies(response).squint_oauth_state;
      expect(value).toBe('');
      expect(attributes).toEqual(
        new Set(['Path=/api/auth', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT']),
      );
    });

    it('does not sign in when the login is rejected', async () => {
      service.finishLogin.mockRejectedValue(new BadRequestException('Sign in failed'));

      const response = await request(ctx.getHttpServer()).get('/api/auth/callback?code=code-1&state=state-1');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message: 'Sign in failed' });
      expect(response.get('Set-Cookie')).toBeUndefined();
    });
  });
});
