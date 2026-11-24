import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Constants } from 'src/constants.js';
import type { BlobResponseDto } from 'src/dtos/blob.dto.js';
import { BlobRepository } from 'src/repositories/blob.repository.js';
import { CryptoRepository } from 'src/repositories/crypto.repository.js';
import { StorageRepository } from 'src/repositories/storage.repository.js';
import { getBlobKey } from 'src/utils/blob.js';

@Injectable()
export class BlobService {
  constructor(
    private blobRepository: BlobRepository,
    private cryptoRepository: CryptoRepository,
    private storageRepository: StorageRepository,
  ) {}

  async upload(sha256: string, bytes: Uint8Array): Promise<BlobResponseDto> {
    if (bytes.length > Constants.Blobs.MaxBytes) {
      throw new BadRequestException('Screenshot is too large');
    }

    if (Constants.Blobs.PngSignature.some((byte, index) => bytes[index] !== byte)) {
      throw new BadRequestException('Screenshot is not a PNG');
    }

    if (this.cryptoRepository.hashSha256(bytes) !== sha256) {
      throw new BadRequestException('Screenshot does not match its hash');
    }

    await this.blobRepository.createIfMissing({ sha256, size: bytes.length }, () =>
      this.storageRepository.put(getBlobKey(sha256), bytes),
    );

    return { sha256 };
  }

  async download(sha256: string) {
    const blob = await this.storageRepository.get(getBlobKey(sha256));
    if (!blob) {
      throw new NotFoundException();
    }

    return blob;
  }
}
