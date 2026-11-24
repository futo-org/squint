import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Constants } from 'src/constants.js';
import { CallbackQueryDto, LoginQueryDto } from 'src/dtos/auth.dto.js';
import { ApiTag } from 'src/enum.js';
import { Authenticated } from 'src/middleware/auth.guard.js';
import { AuthService } from 'src/services/auth.service.js';
import { getOrigin } from 'src/utils/request.js';

@ApiTags(ApiTag.Authentication)
@Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}

  @Get('login')
  @Authenticated({ public: true })
  @ApiExcludeEndpoint()
  async startLogin(@Req() request: Request, @Res() response: Response, @Query() dto: LoginQueryDto): Promise<void> {
    const { url, loginState } = await this.service.startLogin({ origin: getOrigin(request), returnTo: dto.returnTo });
    const { Name, Options } = Constants.Cookies.OAuthState;

    response.cookie(Name, loginState, Options).redirect(url);
  }

  @Get('callback')
  @Authenticated({ public: true })
  @ApiExcludeEndpoint()
  async finishLogin(
    @Req() request: Request,
    @Res() response: Response,
    @Query() _dto: CallbackQueryDto,
  ): Promise<void> {
    const { OAuthState, Session } = Constants.Cookies;
    const cookies: Record<string, string | undefined> = request.cookies ?? {};
    const { token, returnTo } = await this.service.finishLogin({
      url: `${getOrigin(request)}${request.originalUrl}`,
      loginState: cookies[OAuthState.Name],
    });

    response
      .cookie(Session.Name, token, Session.Options)
      .clearCookie(OAuthState.Name, OAuthState.Options)
      .redirect(returnTo);
  }
}
