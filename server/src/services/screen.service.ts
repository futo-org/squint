import { Injectable } from '@nestjs/common';
import type { ScreenResponseDto, ScreenSearchDto } from 'src/dtos/screen.dto.js';
import { ScreenshotVersionRepository } from 'src/repositories/screenshot-version.repository.js';

@Injectable()
export class ScreenService {
  constructor(private screenshotVersionRepository: ScreenshotVersionRepository) {}

  search(dto: ScreenSearchDto): Promise<ScreenResponseDto[]> {
    return this.screenshotVersionRepository.searchScreens(dto);
  }
}
