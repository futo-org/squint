import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReleaseResponseDto } from 'src/dtos/release.dto.js';
import { ApiTag } from 'src/enum.js';
import { Authenticated } from 'src/middleware/auth.guard.js';
import { ReleaseService } from 'src/services/release.service.js';

@ApiTags(ApiTag.Releases)
@Controller('releases')
export class ReleaseController {
  constructor(private service: ReleaseService) {}

  @Get()
  @Authenticated()
  searchReleases(): ReleaseResponseDto[] {
    return this.service.search();
  }
}
