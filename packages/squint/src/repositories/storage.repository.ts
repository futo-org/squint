import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Constants } from '../constants.js';

export class StorageRepository {
  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  readFile(path: string): Promise<Buffer<ArrayBuffer>> {
    return readFile(path);
  }

  writeFile(path: string, data: Uint8Array): Promise<void> {
    return writeFile(path, data);
  }

  copyFile(source: string, target: string): Promise<void> {
    return copyFile(source, target);
  }

  async createDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  createTempDirectory(): Promise<string> {
    return mkdtemp(join(tmpdir(), Constants.Publish.TempPrefix));
  }

  removeDirectory(path: string): Promise<void> {
    return rm(path, { recursive: true, force: true });
  }
}
