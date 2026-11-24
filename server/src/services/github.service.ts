import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PullRequestEventSchema, type GithubWebhookDto } from 'src/dtos/github.dto.js';
import { GithubEvent, PullRequestState } from 'src/enum.js';
import { BuildRepository } from 'src/repositories/build.repository.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';
import { CryptoRepository } from 'src/repositories/crypto.repository.js';
import { PullRequestRepository } from 'src/repositories/pull-request.repository.js';
import { WebsocketRepository } from 'src/repositories/websocket.repository.js';

@Injectable()
export class GithubService {
  constructor(
    private buildRepository: BuildRepository,
    private configRepository: ConfigRepository,
    private cryptoRepository: CryptoRepository,
    private pullRequestRepository: PullRequestRepository,
    private websocketRepository: WebsocketRepository,
  ) {}

  async handleWebhook({ event, signature, payload }: GithubWebhookDto): Promise<void> {
    const isSigned = this.cryptoRepository.verifyHmacSha256({
      secret: this.configRepository.getEnv().github.webhookSecret,
      message: payload,
      signature: signature ?? '',
    });
    if (!isSigned) {
      throw new UnauthorizedException();
    }

    if (event !== GithubEvent.PullRequest) {
      return;
    }

    const result = PullRequestEventSchema.safeParse(JSON.parse(payload));
    if (!result.success) {
      throw new BadRequestException({ message: 'Validation failed', errors: result.error.issues });
    }

    const { repository, pull_request: pullRequest } = result.data;

    await this.pullRequestRepository.upsert({
      repository: repository.full_name,
      number: pullRequest.number,
      title: pullRequest.title,
      state: this.getState(pullRequest),
      updatedAt: new Date(),
    });
    await this.buildRepository.trashOutdated(new Date());
    await this.buildRepository.restoreRetained();
    this.websocketRepository.update('/builds', '/projects');
  }

  private getState({ state, merged }: { state: 'open' | 'closed'; merged?: boolean }) {
    if (merged) {
      return PullRequestState.Merged;
    }

    return state === 'closed' ? PullRequestState.Closed : PullRequestState.Open;
  }
}
