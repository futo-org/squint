import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import z from 'zod';
import { Constants } from 'src/constants.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';

const CiClaimsSchema = z.object({
  repository: z.string(),
  repository_owner: z.string(),
  ref: z.string(),
  job_workflow_ref: z.string(),
});

export type CiClaims = z.infer<typeof CiClaimsSchema>;

export class CiTokenError extends Error {}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

@Injectable()
export class CiRepository {
  constructor(private configRepository: ConfigRepository) {}

  async verifyToken(token: string): Promise<CiClaims> {
    try {
      const issuer = this.configRepository.getEnv().github.oidcIssuer;
      const { payload } = await jwtVerify(token, this.getKeySet(issuer), {
        issuer,
        audience: Constants.Ci.Audience,
      });

      return CiClaimsSchema.parse(payload);
    } catch (error) {
      throw new CiTokenError('Invalid CI token', { cause: error });
    }
  }

  private getKeySet(issuer: string) {
    const keySet = keySets.get(issuer) ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
    keySets.set(issuer, keySet);

    return keySet;
  }
}
