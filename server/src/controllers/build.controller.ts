import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthDto, CiAuthDto } from 'src/dtos/auth.dto.js';
import {
  ApprovalDto,
  BuildCompleteDto,
  BuildCreateDto,
  BuildDetailResponseDto,
  BuildResponseDto,
  BuildScreenshotsDto,
  BuildScreenshotsResponseDto,
  BuildSearchDto,
} from 'src/dtos/build.dto.js';
import { ApiTag } from 'src/enum.js';
import { Auth, Authenticated } from 'src/middleware/auth.guard.js';
import { BuildService } from 'src/services/build.service.js';
import { UUIDParamDto } from 'src/validation.js';

@ApiTags(ApiTag.Builds)
@Controller('builds')
export class BuildController {
  constructor(private service: BuildService) {}

  @Post()
  @Authenticated({ ci: true })
  createBuild(@Auth() auth: CiAuthDto, @Body() dto: BuildCreateDto): Promise<BuildResponseDto> {
    return this.service.create(auth, dto);
  }

  @Get()
  @Authenticated()
  searchBuilds(@Query() dto: BuildSearchDto): Promise<BuildResponseDto[]> {
    return this.service.search(dto);
  }

  @Get(':id')
  @Authenticated()
  getBuild(@Param() { id }: UUIDParamDto): Promise<BuildDetailResponseDto> {
    return this.service.get(id);
  }

  @Put(':id/screenshots')
  @Authenticated({ ci: true })
  setBuildScreenshots(
    @Auth() auth: CiAuthDto,
    @Param() { id }: UUIDParamDto,
    @Body() dto: BuildScreenshotsDto,
  ): Promise<BuildScreenshotsResponseDto> {
    return this.service.setScreenshots(auth, id, dto);
  }

  @Post(':id/complete')
  @Authenticated({ ci: true })
  @HttpCode(HttpStatus.OK)
  completeBuild(
    @Auth() auth: CiAuthDto,
    @Param() { id }: UUIDParamDto,
    @Body() dto: BuildCompleteDto,
  ): Promise<BuildResponseDto> {
    return this.service.complete(auth, id, dto);
  }

  @Put(':id/approval')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  approveBuildScreen(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto, @Body() dto: ApprovalDto): Promise<void> {
    return this.service.approve(auth, id, dto);
  }

  @Delete(':id/approval')
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeBuildScreen(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto, @Query() dto: ApprovalDto): Promise<void> {
    return this.service.revoke(auth, id, dto);
  }
}
