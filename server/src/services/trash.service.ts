import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { Constants } from 'src/constants.js';
import { BlobRepository } from 'src/repositories/blob.repository.js';
import { BuildRepository } from 'src/repositories/build.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';
import { StorageRepository } from 'src/repositories/storage.repository.js';
import { WebsocketRepository } from 'src/repositories/websocket.repository.js';
import { getBlobKey } from 'src/utils/blob.js';

@Injectable()
export class TrashService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private blobRepository: BlobRepository,
    private buildRepository: BuildRepository,
    private logger: LoggingRepository,
    private storageRepository: StorageRepository,
    private websocketRepository: WebsocketRepository,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.handleInterval(), Constants.Trash.IntervalMs);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async update(): Promise<void> {
    const trashed = await this.buildRepository.trashOutdated(new Date());
    const restored = await this.buildRepository.restoreRetained();
    if (trashed.length + restored.length === 0) {
      return;
    }

    this.logger.log(`Moved ${trashed.length} builds to the trash and ${restored.length} back out`);
    this.websocketRepository.update('/builds');
  }

  async empty(): Promise<void> {
    const now = Date.now();
    const builds = await this.buildRepository.deleteTrashedBefore(new Date(now - Constants.Trash.RetentionMs));
    const blobs = await this.blobRepository.deleteUnreferenced(
      new Date(now - Constants.Trash.UnreferencedGraceMs),
      (sha256s) => this.removeFromStorage(sha256s),
    );
    if (builds.length + blobs === 0) {
      return;
    }

    this.logger.log(`Deleted ${builds.length} builds and ${blobs} screenshots from the trash`);
    if (builds.length > 0) {
      this.websocketRepository.update('/builds');
    }
  }

  private async handleInterval(): Promise<void> {
    try {
      await this.update();
      await this.empty();
    } catch (error) {
      this.logger.error('Unable to update the trash', error);
    }
  }

  private async removeFromStorage(sha256s: string[]): Promise<void> {
    try {
      await this.storageRepository.delete(sha256s.map((sha256) => getBlobKey(sha256)));
    } catch (error) {
      this.logger.error(`Unable to delete ${sha256s.length} screenshots from storage`, error);
    }
  }
}
