import { DeleteObjectsCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { Constants } from 'src/constants.js';
import { ConfigRepository } from 'src/repositories/config.repository.js';
import { chunk } from 'src/utils/misc.js';

@Injectable()
export class StorageRepository {
  private client?: S3Client;

  constructor(private configRepository: ConfigRepository) {}

  async put(key: string, bytes: Uint8Array): Promise<void> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.getBucket(),
        Key: key,
        Body: bytes,
        ContentType: Constants.Blobs.ContentType,
      }),
    );
  }

  async get(key: string) {
    try {
      const { Body, ContentLength } = await this.getClient().send(
        new GetObjectCommand({ Bucket: this.getBucket(), Key: key }),
      );

      return { stream: Body as Readable, size: ContentLength };
    } catch (error) {
      if (error instanceof NoSuchKey) {
        return;
      }

      throw error;
    }
  }

  async delete(keys: string[]): Promise<void> {
    for (const batch of chunk(keys, Constants.Blobs.DeleteBatchSize)) {
      const { Errors = [] } = await this.getClient().send(
        new DeleteObjectsCommand({
          Bucket: this.getBucket(),
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      if (Errors.length > 0) {
        throw new Error(`Unable to delete ${Errors.length} objects`, { cause: Errors });
      }
    }
  }

  private getClient() {
    const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } = this.configRepository.getEnv().storage;
    this.client ??= new S3Client({ endpoint, region, forcePathStyle, credentials: { accessKeyId, secretAccessKey } });

    return this.client;
  }

  private getBucket() {
    return this.configRepository.getEnv().storage.bucket;
  }
}
