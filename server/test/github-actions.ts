import { newSigningKey, signJwt, type SigningKey } from 'test/jwt.js';

export const GITHUB_ISSUER = 'https://github-actions.test';

const defaultSigningKey = newSigningKey('github-key-1');

export const newGithubActions = async () => {
  const signingKey = await defaultSigningKey;

  return {
    handle: (request: Request) => {
      if (request.url === `${GITHUB_ISSUER}/.well-known/jwks`) {
        return Response.json({ keys: [signingKey.jwk] });
      }
    },

    token: (claims: Record<string, unknown> = {}, options: { signingKey?: SigningKey } = {}) => {
      const now = Math.floor(Date.now() / 1000);

      return signJwt(options.signingKey ?? signingKey, {
        iss: GITHUB_ISSUER,
        aud: 'squint.futo.org',
        sub: 'repo:immich-app/static-pages:ref:refs/heads/main',
        repository: 'immich-app/static-pages',
        repository_owner: 'immich-app',
        ref: 'refs/heads/main',
        job_workflow_ref: 'immich-app/static-pages/.github/workflows/squint.yml@refs/heads/main',
        iat: now,
        exp: now + 300,
        ...claims,
      });
    },
  };
};

export type GithubActions = Awaited<ReturnType<typeof newGithubActions>>;
