import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diffImages, type Region } from './index.js';

describe('diffImages', () => {
  let directory: string;

  const newImage = (name: string, height: number, black: Region[] = []) => {
    const width = 100;
    const png = new PNG({ width, height });
    png.data.fill(255);
    for (const rectangle of black) {
      for (let y = rectangle.y; y < rectangle.y + rectangle.height; y++) {
        for (let x = rectangle.x; x < rectangle.x + rectangle.width; x++) {
          png.data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
        }
      }
    }

    const path = join(directory, name);
    writeFileSync(path, PNG.sync.write(png));

    return path;
  };

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'squint-diff-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true });
  });

  it('reports identical images as unchanged', async () => {
    const baseline = newImage('baseline.png', 50);
    const current = newImage('current.png', 50);
    const mask = join(directory, 'mask.png');

    await expect(diffImages({ baseline, current, mask })).resolves.toEqual({ status: 'unchanged' });
    expect(existsSync(mask)).toBe(false);
  });

  it('measures the change and where it is', async () => {
    const baseline = newImage('baseline.png', 50);
    const current = newImage('current.png', 50, [
      { x: 10, y: 5, width: 20, height: 10 },
      { x: 80, y: 40, width: 5, height: 5 },
    ]);

    const result = await diffImages({ baseline, current, mask: join(directory, 'mask.png') });

    expect(result).toEqual({
      status: 'changed',
      pixels: 225,
      ratio: 0.045,
      regions: [
        { x: 10, y: 5, width: 20, height: 10 },
        { x: 80, y: 40, width: 5, height: 5 },
      ],
    });
  });

  it('writes a mask that is transparent except for the changed pixels', async () => {
    const baseline = newImage('baseline.png', 50);
    const current = newImage('current.png', 50, [{ x: 10, y: 5, width: 20, height: 10 }]);
    const mask = join(directory, 'mask.png');

    await diffImages({ baseline, current, mask });

    const { width, height, data } = PNG.sync.read(readFileSync(mask));
    const opaque = data.filter((_, index) => index % 4 === 3 && data[index] > 0).length;
    expect({ width, height, opaque }).toEqual({ width: 100, height: 50, opaque: 200 });
  });

  it('reports images of different sizes as resized', async () => {
    const baseline = newImage('baseline.png', 50);
    const current = newImage('current.png', 80);
    const mask = join(directory, 'mask.png');

    await expect(diffImages({ baseline, current, mask })).resolves.toEqual({ status: 'resized' });
    expect(existsSync(mask)).toBe(false);
  });

  it('fails when an image is missing', async () => {
    const baseline = newImage('baseline.png', 50);
    const options = { baseline, current: join(directory, 'missing.png'), mask: join(directory, 'mask.png') };

    await expect(diffImages(options)).rejects.toThrow('missing.png');
  });
});
