import { Constants } from './constants.js';

export type Mask = { width: number; height: number; data: Uint8Array };
export type Region = { x: number; y: number; width: number; height: number };
export type RegionOptions = { cellSize?: number; maxRegions?: number };

type Bounds = { left: number; top: number; right: number; bottom: number };

export const getRegions = (mask: Mask, options: RegionOptions = {}): Region[] => {
  const { cellSize = Constants.Regions.CellSize, maxRegions = Constants.Regions.MaxRegions } = options;
  const columns = Math.ceil(mask.width / cellSize);
  const bounds = joinCells(getCells(mask, cellSize, columns), columns);
  if (bounds.length > maxRegions) {
    return getRegions(mask, { cellSize: cellSize * 2, maxRegions });
  }

  return bounds
    .map(({ left, top, right, bottom }) => ({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 }))
    .toSorted((a, b) => a.y - b.y || a.x - b.x);
};

const getCells = ({ width, height, data }: Mask, cellSize: number, columns: number) => {
  const cells = new Map<number, Bounds>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) {
        continue;
      }

      const key = Math.floor(y / cellSize) * columns + Math.floor(x / cellSize);
      const pixel = { left: x, top: y, right: x, bottom: y };
      const cell = cells.get(key);
      if (cell) {
        extend(cell, pixel);
      } else {
        cells.set(key, pixel);
      }
    }
  }

  return cells;
};

const joinCells = (cells: Map<number, Bounds>, columns: number) => {
  const pending = new Map(cells);
  const regions: Bounds[] = [];
  for (const [start, cell] of cells) {
    if (!pending.delete(start)) {
      continue;
    }

    const region = { ...cell };
    const queue = [start];
    for (let key = queue.pop(); key !== undefined; key = queue.pop()) {
      for (const neighbour of getNeighbours(key, columns)) {
        const next = pending.get(neighbour);
        if (!next) {
          continue;
        }

        pending.delete(neighbour);
        extend(region, next);
        queue.push(neighbour);
      }
    }

    regions.push(region);
  }

  return regions;
};

const extend = (target: Bounds, { left, top, right, bottom }: Bounds) => {
  target.left = Math.min(target.left, left);
  target.top = Math.min(target.top, top);
  target.right = Math.max(target.right, right);
  target.bottom = Math.max(target.bottom, bottom);
};

const getNeighbours = (key: number, columns: number) => {
  const column = key % columns;
  const offsets = [-1, 0, 1].filter((offset) => column + offset >= 0 && column + offset < columns);

  return [-columns, 0, columns].flatMap((row) => offsets.map((offset) => key + row + offset));
};
