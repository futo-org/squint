import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { UserResponseDto } from 'src/dtos/user.dto.js';
import { ApiTag } from 'src/enum.js';
import { Auth, Authenticated } from 'src/middleware/auth.guard.js';

@ApiTags(ApiTag.Users)
@Controller('users')
export class UserController {
  @Get('me')
  @Authenticated()
  getMyUser(@Auth() auth: AuthDto): UserResponseDto {
    return auth.user;
  }
}
