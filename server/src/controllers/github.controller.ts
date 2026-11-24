import { Controller, Headers, HttpCode, HttpStatus, Post, type RawBodyRequest, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiTag, GithubHeader } from 'src/enum.js';
import { Authenticated } from 'src/middleware/auth.guard.js';
import { GithubService } from 'src/services/github.service.js';

@ApiTags(ApiTag.Github)
@Controller('github')
export class GithubController {
  constructor(private service: GithubService) {}

  @Post('webhook')
  @Authenticated({ public: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiExcludeEndpoint()
  handleGithubWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers(GithubHeader.Event) event?: string,
    @Headers(GithubHeader.Signature) signature?: string,
  ): Promise<void> {
    return this.service.handleWebhook({ event, signature, payload: request.rawBody?.toString() ?? '' });
  }
}
