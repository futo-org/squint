import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServerAboutResponseDto, ServerPingResponseDto } from 'src/dtos/server.dto.js';
import { ApiTag } from 'src/enum.js';
import { Authenticated } from 'src/middleware/auth.guard.js';
import { ServerService } from 'src/services/server.service.js';

@ApiTags(ApiTag.Server)
@Controller('server')
export class ServerController {
  constructor(private service: ServerService) {}

  @Get('ping')
  @Authenticated({ public: true })
  pingServer(): ServerPingResponseDto {
    return { res: 'pong' };
  }

  @Get('about')
  @Authenticated()
  getServerAbout(): ServerAboutResponseDto {
    return this.service.getAbout();
  }
}
