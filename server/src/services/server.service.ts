import { Injectable } from '@nestjs/common';
import { Constants } from 'src/constants.js';
import type { ServerAboutResponseDto } from 'src/dtos/server.dto.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';

@Injectable()
export class ServerService {
  constructor(private configRepository: ConfigRepository) {}

  getAbout(): ServerAboutResponseDto {
    const { Version, RepositoryUrl } = Constants.App;
    const { commit, date } = this.configRepository.getEnv().build;

    return {
      version: Version,
      repositoryUrl: RepositoryUrl,
      commit: commit ?? null,
      commitUrl: commit ? `${RepositoryUrl}/commit/${commit}` : null,
      buildDate: date ?? null,
    };
  }
}
