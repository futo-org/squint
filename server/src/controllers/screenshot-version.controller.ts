import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScreenshotVersionResponseDto, ScreenshotVersionSearchDto } from 'src/dtos/screenshot-version.dto.js';
import { ApiTag } from 'src/enum.js';
import { Authenticated } from 'src/middleware/auth.guard.js';
import { ScreenshotVersionService } from 'src/services/screenshot-version.service.js';

@ApiTags(ApiTag.Screens)
@Controller('screenshot-versions')
export class ScreenshotVersionController {
  constructor(private service: ScreenshotVersionService) {}

  @Get()
  @Authenticated()
  searchScreenshotVersions(@Query() dto: ScreenshotVersionSearchDto): Promise<ScreenshotVersionResponseDto[]> {
    return this.service.search(dto);
  }
}
