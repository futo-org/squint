import { Injectable } from '@nestjs/common';
import type { ProjectResponseDto, ProjectSearchDto } from 'src/dtos/project.dto.js';
import { ProjectRepository } from 'src/repositories/project.repository.js';

@Injectable()
export class ProjectService {
  constructor(private projectRepository: ProjectRepository) {}

  async search(dto: ProjectSearchDto): Promise<ProjectResponseDto[]> {
    const projects = await this.projectRepository.search(dto);

    return projects.map((project) => ({
      ...project,
      screenshotCount: project.screenshotCount ?? 0,
      openPullRequestCount: project.openPullRequestCount ?? 0,
    }));
  }
}
