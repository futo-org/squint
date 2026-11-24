import { Injectable } from '@nestjs/common';
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  ClientSecretPost,
  discovery,
  enableNonRepudiationChecks,
  fetchUserInfo,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from 'openid-client';
import z from 'zod';
import { Constants } from 'src/constants.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';

const OAuthProfileSchema = z.object({
  sub: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.string().optional(),
  picture: z
    .url({ protocol: /^https$/ })
    .optional()
    .catch(undefined),
});

export type OAuthProfile = z.infer<typeof OAuthProfileSchema>;

export class OAuthError extends Error {}

@Injectable()
export class OAuthRepository {
  constructor(private configRepository: ConfigRepository) {}

  async authorize({ redirectUri }: { redirectUri: string }) {
    const client = await this.getClient();
    const state = randomState();
    const nonce = randomNonce();
    const codeVerifier = randomPKCECodeVerifier();
    const { href: url } = buildAuthorizationUrl(client, {
      redirect_uri: redirectUri,
      scope: Constants.OAuth.Scope,
      state,
      nonce,
      code_challenge: await calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });

    return { url, state, nonce, codeVerifier };
  }

  async getProfile(options: {
    url: string;
    state: string;
    nonce: string;
    codeVerifier: string;
  }): Promise<OAuthProfile> {
    const { url, state, nonce, codeVerifier } = options;

    try {
      const client = await this.getClient();
      const tokens = await authorizationCodeGrant(client, new URL(url), {
        expectedState: state,
        expectedNonce: nonce,
        pkceCodeVerifier: codeVerifier,
        idTokenExpected: true,
      });
      const subject = tokens.claims()?.sub ?? '';

      return OAuthProfileSchema.parse(await fetchUserInfo(client, tokens.access_token, subject));
    } catch (error) {
      throw new OAuthError('Unable to get the OAuth profile', { cause: error });
    }
  }

  private async getClient() {
    const { issuer, clientId, clientSecret } = this.configRepository.getEnv().oauth;

    return discovery(new URL(issuer), clientId, undefined, ClientSecretPost(clientSecret), {
      execute: [enableNonRepudiationChecks],
    });
  }
}
