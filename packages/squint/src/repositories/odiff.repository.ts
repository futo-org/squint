import { compare } from 'odiff-bin';
import { DiffStatus } from '../enum.js';

export type Comparison =
  { status: DiffStatus.Unchanged } | { status: DiffStatus.Resized } | { status: DiffStatus.Changed; pixels: number };

export class OdiffRepository {
  async compare(baseline: string, current: string, mask: string): Promise<Comparison> {
    const result = await compare(baseline, current, mask, { outputDiffMask: true, failOnLayoutDiff: true });
    if (result.match) {
      return { status: DiffStatus.Unchanged };
    }

    if (result.reason === 'pixel-diff') {
      return { status: DiffStatus.Changed, pixels: result.diffCount };
    }

    return { status: DiffStatus.Resized };
  }
}
