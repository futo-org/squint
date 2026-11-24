import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Constants } from 'src/constants.js';
import { LoginStateSchema, type AuthDto, type CiAuthDto, type LoginStateDto } from 'src/dtos/auth.dto.js';
import { CiRepository, CiTokenError } from 'src/repositories/ci.repository.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';
import { CryptoRepository } from 'src/repositories/crypto.repository.js';
import { OAuthError, OAuthRepository } from 'src/repositories/oauth.repository.js';
import { SessionRepository } from 'src/repositories/session.repository.js';
import { UserRepository } from 'src/repositories/user.repository.js';

@Injectable()
export class AuthService {
  constructor(
    private ciRepository: CiRepository,
    private configRepository: ConfigRepository,
    private cryptoRepository: CryptoRepository,
    private oauthRepository: OAuthRepository,
    private sessionRepository: SessionRepository,
    private userRepository: UserRepository,
  ) {}

  async startLogin({ origin, returnTo }: { origin: string; returnTo?: string }) {
    const redirectUri = `${origin}${Constants.OAuth.CallbackPath}`;
    const { url, ...oauth } = await this.oauthRepository.authorize({ redirectUri });
    const loginState: LoginStateDto = { ...oauth, returnTo: this.getReturnUrl(origin, returnTo) };

    return { url, loginState };
  }

  async finishLogin({ url, loginState }: { url: string; loginState?: unknown }) {
    const result = LoginStateSchema.safeParse(loginState);
    if (!result.success) {
      throw new BadRequestException({ message: 'Validation failed', errors: result.error.issues });
    }

    const { returnTo, ...oauth } = result.data;
    const profile = await this.getProfile({ url, ...oauth });
    const role = this.getRole(profile.role);
    if (!role) {
      throw new ForbiddenException();
    }

    const now = new Date();
    const user = await this.userRepository.upsert({
      oauthId: profile.sub,
      email: profile.email,
      name: profile.name,
      role,
      avatarUrl: profile.picture ?? null,
      updatedAt: now,
    });

    const token = this.cryptoRepository.randomToken();
    await this.sessionRepository.create({
      token: this.cryptoRepository.hashSha256(token),
      userId: user.id,
      expiresAt: new Date(now.getTime() + Constants.Session.MaxAgeSeconds * 1000),
    });

    return { token, returnTo };
  }

  async authenticate(token?: string): Promise<AuthDto> {
    if (!token) {
      throw new UnauthorizedException();
    }

    const session = await this.sessionRepository.getByToken(this.cryptoRepository.hashSha256(token));
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException();
    }

    const { id, userId, email, name, role, avatarUrl } = session;

    return { sessionId: id, user: { id: userId, email, name, role, avatarUrl } };
  }

  async authenticateCi(token?: string): Promise<CiAuthDto> {
    if (!token) {
      throw new UnauthorizedException();
    }

    const claims = await this.getCiClaims(token);
    if (!this.configRepository.getEnv().github.owners.includes(claims.repository_owner)) {
      throw new ForbiddenException();
    }

    return {
      repository: claims.repository,
      owner: claims.repository_owner,
      ref: claims.ref,
      workflowRef: claims.job_workflow_ref,
    };
  }

  private async getCiClaims(token: string) {
    try {
      return await this.ciRepository.verifyToken(token);
    } catch (error) {
      if (error instanceof CiTokenError) {
        throw new UnauthorizedException(undefined, { cause: error.cause });
      }

      throw error;
    }
  }

  private getReturnUrl(origin: string, returnTo = '/') {
    const url = URL.parse(returnTo, origin);
    if (!url || url.origin !== origin) {
      return `${origin}/`;
    }

    return url.href;
  }

  private async getProfile(options: { url: string; state: string; nonce: string; codeVerifier: string }) {
    try {
      return await this.oauthRepository.getProfile(options);
    } catch (error) {
      if (error instanceof OAuthError) {
        throw new BadRequestException('Sign in failed', { cause: error.cause });
      }

      throw error;
    }
  }

  private getRole(claim = '') {
    const claims = new Set(claim.split(','));

    return Constants.OAuth.Roles.find((item) => claims.has(item.claim))?.role;
  }
}
