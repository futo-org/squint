import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardResponseDto } from 'src/dtos/dashboard.dto.js';
import { ApiTag } from 'src/enum.js';
import { Authenticated } from 'src/middleware/auth.guard.js';
import { DashboardService } from 'src/services/dashboard.service.js';

@ApiTags(ApiTag.Dashboard)
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get()
  @Authenticated()
  getDashboard(): Promise<DashboardResponseDto> {
    return this.service.get();
  }
}
