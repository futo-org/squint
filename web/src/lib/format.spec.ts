import { describe, expect, it } from 'vitest';
import { formatPercent, timeAgo } from './format.js';

describe(timeAgo.name, () => {
  const now = new Date('2026-11-17T12:00:00.000Z').getTime();

  it.each([
    { iso: '2026-11-17T11:59:30.000Z', expected: 'just now' },
    { iso: '2026-11-17T11:55:00.000Z', expected: '5 minutes ago' },
    { iso: '2026-11-17T09:00:00.000Z', expected: '3 hours ago' },
    { iso: '2026-11-16T12:00:00.000Z', expected: 'yesterday' },
    { iso: '2026-11-14T12:00:00.000Z', expected: '3 days ago' },
  ])('describes $iso as $expected', ({ iso, expected }) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});

describe(formatPercent.name, () => {
  it.each([
    { ratio: 0.0235, expected: '2.35%' },
    { ratio: 0.026708984, expected: '2.67%' },
    { ratio: 0.5, expected: '50%' },
    { ratio: 1, expected: '100%' },
    { ratio: 0.0001, expected: '0.01%' },
    { ratio: 0.000001, expected: '<0.01%' },
    { ratio: 0, expected: '0%' },
  ])('formats $ratio as $expected', ({ ratio, expected }) => {
    expect(formatPercent(ratio)).toBe(expected);
  });
});
