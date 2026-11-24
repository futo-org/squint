import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { DB } from 'src/schema/index.js';
import { AuthService } from 'src/services/auth.service.js';
import { ORIGIN } from 'test/constants.js';
import { fakeFetch } from 'test/fake-fetch.js';
import { type GithubActions, newGithubActions } from 'test/github-actions.js';
import { type IdentityProfile, type IdentityProvider, newIdentityProvider } from 'test/identity-provider.js';
import { newSigningKey } from 'test/jwt.js';
import { type MediumContext, newMediumContext } from 'test/medium.factory.js';
import { getKyselyDB, newEnv } from 'test/utils.js';

const approver: IdentityProfile = {
  sub: 'user-1',
  email: 'approver@immich.app',
  name: 'Approver',
  role: 'squint-approver',
};

const newCallbackUrl = (code: string, state: string) => `${ORIGIN}/api/auth/callback?code=${code}&state=${state}`;

describe(AuthService.name, () => {
  let db: Kysely<DB>;
  let ctx: MediumContext;
  let sut: AuthService;
  let idp: IdentityProvider;
  let github: GithubActions;

  type Grant = Parameters<IdentityProvider['authorize']>[2];

  const authorize = async (profile: IdentityProfile, grant: Grant = {}) => {
    const { url, loginState } = await sut.startLogin({ origin: ORIGIN });
    const { code, state } = idp.authorize(url, profile, grant);

    return { code, state, loginState, url: newCallbackUrl(code, state) };
  };

  beforeEach(async () => {
    db = await getKyselyDB();
    ctx = await newMediumContext(db);
    sut = ctx.authService;
    idp = await newIdentityProvider();
    github = await newGithubActions();
    fakeFetch(idp, github);
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await db.destroy();
  });

  describe('startLogin', () => {
    it('sends the user to the identity provider', async () => {
      const { url } = await sut.startLogin({ origin: ORIGIN });

      const { origin, pathname, searchParams } = new URL(url);
      expect(origin + pathname).toBe('https://idp.test/oauth/v2/authorize');
      expect(Object.fromEntries(searchParams)).toEqual({
        response_type: 'code',
        client_id: 'squint-client',
        redirect_uri: 'https://squint.futo.org/api/auth/callback',
        scope: 'openid email profile',
        state: expect.stringMatching(/^[\w-]{20,}$/),
        nonce: expect.stringMatching(/^[\w-]{20,}$/),
        code_challenge: expect.stringMatching(/^[\w-]{43}$/),
        code_challenge_method: 'S256',
      });
    });

    it('remembers the page that started the login', async () => {
      const { loginState } = await sut.startLogin({ origin: ORIGIN, returnTo: '/builds?page=2' });

      expect(loginState.returnTo).toBe('https://squint.futo.org/builds?page=2');
    });

    it.each(['https://evil.test/', '//evil.test', String.raw`/\evil.test`, '/.//evil.test'])(
      'does not return to another site (%s)',
      async (returnTo) => {
        const { loginState } = await sut.startLogin({ origin: ORIGIN, returnTo });

        expect(new URL(loginState.returnTo).origin).toBe('https://squint.futo.org');
      },
    );
  });

  describe('finishLogin', () => {
    it('signs the user in', async () => {
      const { url, loginState } = await authorize(approver);

      const { token, returnTo } = await sut.finishLogin({ url, loginState });

      expect(returnTo).toBe('https://squint.futo.org/');
      await expect(sut.authenticate(token)).resolves.toEqual({
        sessionId: expect.any(String),
        user: {
          id: expect.any(String),
          email: 'approver@immich.app',
          name: 'Approver',
          role: 'approver',
          avatarUrl: null,
        },
      });
    });

    it('keeps the profile picture the identity provider has', async () => {
      const picture = 'https://auth.internal.futo.org/assets/v1/users/user-1/avatar';
      const { token } = await ctx.signIn(idp, { ...approver, picture });

      await expect(sut.authenticate(token)).resolves.toMatchObject({ user: { avatarUrl: picture } });
    });

    it('drops the profile picture once it is removed', async () => {
      await ctx.signIn(idp, { ...approver, picture: 'https://auth.internal.futo.org/assets/v1/users/user-1/avatar' });

      const { token } = await ctx.signIn(idp, approver);

      await expect(sut.authenticate(token)).resolves.toMatchObject({ user: { avatarUrl: null } });
    });

    it.each([['http:', '', 'auth.internal.futo.org', 'avatar'].join('/'), 'javascript:alert(1)', 'avatar.png', ''])(
      'signs in without the picture "%s"',
      async (picture) => {
        const { token } = await ctx.signIn(idp, { ...approver, picture });

        await expect(sut.authenticate(token)).resolves.toMatchObject({ user: { name: 'Approver', avatarUrl: null } });
      },
    );

    it('signs a viewer in as a viewer', async () => {
      const { url, loginState } = await authorize({ ...approver, role: 'squint-viewer' });

      const { token } = await sut.finishLogin({ url, loginState });

      await expect(sut.authenticate(token)).resolves.toMatchObject({ user: { role: 'viewer' } });
    });

    it('updates the user on the next sign in', async () => {
      const first = await ctx.signIn(idp, { ...approver, role: 'squint-viewer', name: 'Old Name' });
      const { url, loginState } = await authorize({ ...approver, role: 'squint-approver', name: 'New Name' });

      const { token } = await sut.finishLogin({ url, loginState });

      await expect(sut.authenticate(token)).resolves.toMatchObject({
        user: { id: first.auth.user.id, email: 'approver@immich.app', name: 'New Name', role: 'approver' },
      });
    });

    it('rejects a user without a squint role', async () => {
      const { url, loginState } = await authorize({ ...approver, role: undefined });

      const result = sut.finishLogin({ url, loginState });

      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a profile without an email', async () => {
      const { email: _email, ...profile } = approver;
      const { url, loginState } = await authorize(profile as IdentityProfile);

      const result = sut.finishLogin({ url, loginState });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a state that does not match the login', async () => {
      const { code, loginState } = await authorize(approver);

      const result = sut.finishLogin({ url: newCallbackUrl(code, 'other-state'), loginState });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a login without its login state', async () => {
      const { url } = await authorize(approver);

      const result = sut.finishLogin({ url });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toMatchObject({ message: 'Validation failed' });
    });

    it.each(['not-json', {}, { state: 1 }])('rejects a malformed login state (%j)', async (loginState) => {
      const { url } = await authorize(approver);

      const result = sut.finishLogin({ url, loginState });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toMatchObject({ message: 'Validation failed' });
    });

    it('rejects a code the identity provider does not know', async () => {
      const { state, loginState } = await authorize(approver);

      const result = sut.finishLogin({ url: newCallbackUrl('unknown', state), loginState });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a code verifier from another login', async () => {
      const other = await authorize(approver);
      const { url, loginState } = await authorize(approver);

      const result = sut.finishLogin({
        url,
        loginState: { ...loginState, codeVerifier: other.loginState.codeVerifier },
      });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an id token issued for another login', async () => {
      const { url, loginState } = await authorize(approver, { nonce: 'another-login' });

      const result = sut.finishLogin({ url, loginState });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an id token signed by another key', async () => {
      const signingKey = await newSigningKey('key-1');
      const { url, loginState } = await authorize(approver, { signingKey });

      const result = sut.finishLogin({ url, loginState });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('authenticate', () => {
    it('requires a session token', async () => {
      const result = sut.authenticate();

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown session token', async () => {
      await ctx.signIn(idp, approver);

      const result = sut.authenticate('unknown');

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('keeps a session for 7 days', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T00:00:00Z') });
      const { token } = await ctx.signIn(idp, approver);
      vi.setSystemTime(new Date('2026-11-07T23:59:59Z'));

      const result = sut.authenticate(token);

      await expect(result).resolves.toMatchObject({ user: { email: 'approver@immich.app' } });
    });

    it('rejects a session after 7 days', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T00:00:00Z') });
      const { token } = await ctx.signIn(idp, approver);
      vi.setSystemTime(new Date('2026-11-08T00:00:00Z'));

      const result = sut.authenticate(token);

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('authenticateCi', () => {
    it('signs a workflow in', async () => {
      const token = await github.token();

      const result = sut.authenticateCi(token);

      await expect(result).resolves.toEqual({
        repository: 'immich-app/static-pages',
        owner: 'immich-app',
        ref: 'refs/heads/main',
        workflowRef: 'immich-app/static-pages/.github/workflows/squint.yml@refs/heads/main',
      });
    });

    it('requires a token', async () => {
      const result = sut.authenticateCi();

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token signed by another key', async () => {
      const signingKey = await newSigningKey('github-key-1');
      const token = await github.token({}, { signingKey });

      const result = sut.authenticateCi(token);

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token issued for another audience', async () => {
      const token = await github.token({ aud: 'https://example.com' });

      const result = sut.authenticateCi(token);

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-01T00:00:00Z') });
      const token = await github.token();
      vi.setSystemTime(new Date('2026-11-01T01:00:00Z'));

      const result = sut.authenticateCi(token);

      await expect(result).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts a repository from a configured owner', async () => {
      ctx = await newMediumContext(db, { github: { ...newEnv().github, owners: ['futo-org'] } });
      const token = await github.token({ repository: 'futo-org/squint', repository_owner: 'futo-org' });

      const result = ctx.authService.authenticateCi(token);

      await expect(result).resolves.toMatchObject({ repository: 'futo-org/squint', owner: 'futo-org' });
    });

    it('rejects a repository outside the allowed owners', async () => {
      const token = await github.token({ repository: 'someone/fork', repository_owner: 'someone' });

      const result = sut.authenticateCi(token);

      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
