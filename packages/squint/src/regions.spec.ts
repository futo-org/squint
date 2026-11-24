import { describe, expect, it } from 'vitest';
import { getRegions } from './regions.js';

const newMask = (width: number, height: number, changed: Array<[number, number]>) => {
  const data = new Uint8Array(width * height * 4);
  for (const [x, y] of changed) {
    data[(y * width + x) * 4 + 3] = 255;
  }

  return { width, height, data };
};

const fill = (x: number, y: number, width: number, height: number) =>
  Array.from({ length: width * height }, (_, index): [number, number] => [
    x + (index % width),
    y + Math.floor(index / width),
  ]);

describe('getRegions', () => {
  it('returns nothing for a mask without changes', () => {
    expect(getRegions(newMask(100, 100, []))).toEqual([]);
  });

  it('boxes one change tightly', () => {
    const mask = newMask(200, 200, fill(40, 50, 30, 20));

    expect(getRegions(mask)).toEqual([{ x: 40, y: 50, width: 30, height: 20 }]);
  });

  it('boxes a single pixel', () => {
    expect(getRegions(newMask(200, 200, [[199, 0]]))).toEqual([{ x: 199, y: 0, width: 1, height: 1 }]);
  });

  it('keeps changes that are far apart separate, top to bottom', () => {
    const mask = newMask(400, 400, [...fill(300, 320, 10, 10), ...fill(20, 10, 10, 10)]);

    expect(getRegions(mask)).toEqual([
      { x: 20, y: 10, width: 10, height: 10 },
      { x: 300, y: 320, width: 10, height: 10 },
    ]);
  });

  it('joins changes that are close together', () => {
    const mask = newMask(400, 400, [...fill(100, 100, 5, 5), ...fill(110, 104, 5, 5)]);

    expect(getRegions(mask)).toEqual([{ x: 100, y: 100, width: 15, height: 9 }]);
  });

  it('does not join changes on opposite edges of the image', () => {
    const mask = newMask(200, 200, [
      [199, 8],
      [0, 24],
    ]);

    expect(getRegions(mask)).toEqual([
      { x: 199, y: 8, width: 1, height: 1 },
      { x: 0, y: 24, width: 1, height: 1 },
    ]);
  });

  it('joins neighbours until the regions fit the limit', () => {
    const mask = newMask(400, 100, [...fill(10, 10, 4, 4), ...fill(60, 10, 4, 4), ...fill(300, 10, 4, 4)]);

    expect(getRegions(mask, { maxRegions: 2 })).toEqual([
      { x: 10, y: 10, width: 54, height: 4 },
      { x: 300, y: 10, width: 4, height: 4 },
    ]);
  });

  it('covers every change with one region when the limit is one', () => {
    const mask = newMask(400, 400, [...fill(0, 0, 2, 2), ...fill(398, 398, 2, 2)]);

    expect(getRegions(mask, { maxRegions: 1 })).toEqual([{ x: 0, y: 0, width: 400, height: 400 }]);
  });
});
