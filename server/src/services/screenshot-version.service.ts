import { Injectable } from '@nestjs/common';
import { Constants } from 'src/constants.js';
import type { ScreenshotVersionResponseDto, ScreenshotVersionSearchDto } from 'src/dtos/screenshot-version.dto.js';
import { ScreenshotVersionRepository } from 'src/repositories/screenshot-version.repository.js';

@Injectable()
export class ScreenshotVersionService {
  constructor(private screenshotVersionRepository: ScreenshotVersionRepository) {}

  async search(dto: ScreenshotVersionSearchDto): Promise<ScreenshotVersionResponseDto[]> {
    const versions = await this.screenshotVersionRepository.search(dto);

    return versions.map(({ repository, ...version }) => ({
      ...version,
      commitUrl: `${Constants.Github.Url}/${repository}/commit/${version.commit}`,
    }));
  }
}
