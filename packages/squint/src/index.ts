import { OdiffRepository } from './repositories/odiff.repository.js';
import { PngRepository } from './repositories/png.repository.js';
import { type DiffOptions, DiffService } from './services/diff.service.js';

export { DiffStatus } from './enum.js';
export type { Region } from './regions.js';
export type { DiffOptions, DiffResult } from './services/diff.service.js';

export const diffImages = (options: DiffOptions) =>
  new DiffService(new OdiffRepository(), new PngRepository()).diff(options);
