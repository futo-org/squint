import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScreenResponseDto, ScreenSearchDto } from 'src/dtos/screen.dto.js';
import { ApiTag } from 'src/enum.js';
import { Authenticated } from 'src/middleware/auth.guard.js';
import { ScreenService } from 'src/services/screen.service.js';

@ApiTags(ApiTag.Screens)
@Controller('screens')
export class ScreenController {
  constructor(private service: ScreenService) {}

  @Get()
  @Authenticated()
  searchScreens(@Query() dto: ScreenSearchDto): Promise<ScreenResponseDto[]> {
    return this.service.search(dto);
  }
}
