import { DiffStatus } from '../enum.js';
import { getRegions, type Region } from '../regions.js';
import type { OdiffRepository } from '../repositories/odiff.repository.js';
import type { PngRepository } from '../repositories/png.repository.js';

export type DiffOptions = { baseline: string; current: string; mask: string };

export type DiffResult =
  | { status: DiffStatus.Unchanged }
  | { status: DiffStatus.Resized }
  | { status: DiffStatus.Changed; pixels: number; ratio: number; regions: Region[] };

export class DiffService {
  constructor(
    private odiffRepository: OdiffRepository,
    private pngRepository: PngRepository,
  ) {}

  async diff({ baseline, current, mask }: DiffOptions): Promise<DiffResult> {
    const comparison = await this.odiffRepository.compare(baseline, current, mask);
    if (comparison.status !== DiffStatus.Changed) {
      return comparison;
    }

    const image = await this.pngRepository.read(mask);

    return {
      status: DiffStatus.Changed,
      pixels: comparison.pixels,
      ratio: comparison.pixels / (image.width * image.height),
      regions: getRegions(image),
    };
  }
}
