import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProjectResponseDto, ProjectSearchDto } from 'src/dtos/project.dto.js';
import { ApiTag } from 'src/enum.js';
import { Authenticated } from 'src/middleware/auth.guard.js';
import { ProjectService } from 'src/services/project.service.js';

@ApiTags(ApiTag.Projects)
@Controller('projects')
export class ProjectController {
  constructor(private service: ProjectService) {}

  @Get()
  @Authenticated()
  searchProjects(@Query() dto: ProjectSearchDto): Promise<ProjectResponseDto[]> {
    return this.service.search(dto);
  }
}
