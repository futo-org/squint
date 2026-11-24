import { Injectable } from '@nestjs/common';
import { Constants } from 'src/constants.js';
import type { DashboardResponseDto } from 'src/dtos/dashboard.dto.js';
import { ScreenshotVersionRepository } from 'src/repositories/screenshot-version.repository.js';

@Injectable()
export class DashboardService {
  constructor(private screenshotVersionRepository: ScreenshotVersionRepository) {}

  async get(): Promise<DashboardResponseDto> {
    const since = new Date(Date.now() - Constants.Dashboard.HistoryMs);

    return { history: await this.screenshotVersionRepository.getHistory(since) };
  }
}
