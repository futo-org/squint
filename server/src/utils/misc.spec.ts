import { chunk } from 'src/utils/misc.js';

describe(chunk.name, () => {
  it.each([
    { items: [1, 2, 3, 4, 5], size: 2, expected: [[1, 2], [3, 4], [5]] },
    {
      items: [1, 2, 3, 4],
      size: 2,
      expected: [
        [1, 2],
        [3, 4],
      ],
    },
    { items: [1], size: 3, expected: [[1]] },
    { items: [], size: 3, expected: [] },
  ])('splits $items.length items into groups of $size', ({ items, size, expected }) => {
    expect(chunk(items, size)).toEqual(expected);
  });
});
