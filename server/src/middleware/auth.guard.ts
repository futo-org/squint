import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  applyDecorators,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { Constants } from 'src/constants.js';
import type { AnyAuthDto } from 'src/dtos/auth.dto.js';
import { MetadataKey } from 'src/enum.js';
import { AuthService } from 'src/services/auth.service.js';

type PublicRoute = { public: true; ci?: never; user?: never };
type CiRoute = { ci: true; user?: true; public?: never };
type UserRoute = { public?: never; ci?: never; user?: never };
export type AuthenticatedOptions = PublicRoute | CiRoute | UserRoute;

export type AuthRequest = Request & { auth?: AnyAuthDto };

export const Authenticated = (options: AuthenticatedOptions = {}): ReturnType<typeof applyDecorators> => {
  const decorators: MethodDecorator[] = [SetMetadata(MetadataKey.AuthRoute, options)];
  if (options.ci) {
    decorators.push(ApiBearerAuth());
  }

  if (!options.public && (!options.ci || options.user)) {
    decorators.push(ApiCookieAuth());
  }

  return applyDecorators(...decorators);
};

export const Auth = createParamDecorator(
  (_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<AuthRequest>().auth,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const options = this.reflector.getAllAndOverride<AuthenticatedOptions | undefined>(MetadataKey.AuthRoute, targets);
    if (!options) {
      throw new Error(`Route ${context.getHandler().name} does not declare @Authenticated()`);
    }

    if (options.public) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = getBearerToken(request);
    const cookies: Record<string, string | undefined> = request.cookies ?? {};

    request.auth =
      options.ci && (token || !options.user)
        ? await this.authService.authenticateCi(token)
        : await this.authService.authenticate(cookies[Constants.Cookies.Session.Name]);

    return true;
  }
}

const getBearerToken = (request: Request) => {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ', 2);

  return scheme === 'Bearer' ? token : undefined;
};
