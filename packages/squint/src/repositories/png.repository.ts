import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import type { Mask } from '../regions.js';

export type Size = { width: number; height: number };

export class PngRepository {
  async read(path: string): Promise<Mask> {
    const { width, height, data } = PNG.sync.read(await readFile(path));

    return { width, height, data };
  }

  getSize(data: Buffer): Size {
    const { width, height } = PNG.sync.read(data);

    return { width, height };
  }
}
