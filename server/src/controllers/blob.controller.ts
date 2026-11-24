import { Body, Controller, Get, Header, Param, Put, StreamableFile } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Constants } from 'src/constants.js';
import { BlobParamDto, BlobResponseDto } from 'src/dtos/blob.dto.js';
import { ApiTag } from 'src/enum.js';
import { Authenticated } from 'src/middleware/auth.guard.js';
import { BlobService } from 'src/services/blob.service.js';

const binary = { schema: { type: 'string', format: 'binary' } } as const;

@ApiTags(ApiTag.Blobs)
@Controller('blobs')
export class BlobController {
  constructor(private service: BlobService) {}

  @Put(':sha256')
  @Authenticated({ ci: true })
  @ApiConsumes(Constants.Blobs.UploadContentType)
  @ApiBody(binary)
  uploadBlob(@Param() { sha256 }: BlobParamDto, @Body() body: unknown): Promise<BlobResponseDto> {
    return this.service.upload(sha256, Buffer.isBuffer(body) ? body : Buffer.alloc(0));
  }

  @Get(':sha256')
  @Authenticated({ ci: true, user: true })
  @Header('cache-control', Constants.Blobs.CacheControl)
  @ApiOkResponse({ content: { [Constants.Blobs.ContentType]: binary } })
  async getBlob(@Param() { sha256 }: BlobParamDto): Promise<StreamableFile> {
    const { stream, size } = await this.service.download(sha256);

    return new StreamableFile(stream, { type: Constants.Blobs.ContentType, length: size });
  }
}
