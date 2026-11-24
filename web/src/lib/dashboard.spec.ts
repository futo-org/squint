import { describe, expect, it } from 'vitest';
import { getChange, getTrend } from './dashboard.js';

const today = new Date('2026-11-18T15:30:00Z');

describe(getTrend.name, () => {
  it('has a point for every day from the first build until today', () => {
    const history = [
      { date: '2026-11-15', screenshotCount: 10 },
      { date: '2026-11-16', screenshotCount: 12 },
      { date: '2026-11-18', screenshotCount: 15 },
    ];

    expect(getTrend(history, today)).toEqual([
      { date: '2026-11-15', value: 10 },
      { date: '2026-11-16', value: 12 },
      { date: '2026-11-17', value: 12 },
      { date: '2026-11-18', value: 15 },
    ]);
  });

  it('carries the last count forward to today', () => {
    expect(getTrend([{ date: '2026-11-16', screenshotCount: 4 }], today)).toEqual([
      { date: '2026-11-16', value: 4 },
      { date: '2026-11-17', value: 4 },
      { date: '2026-11-18', value: 4 },
    ]);
  });

  it('crosses a month boundary', () => {
    const trend = getTrend([{ date: '2026-10-30', screenshotCount: 1 }], new Date('2026-11-01T00:00:00Z'));

    expect(trend.map(({ date }) => date)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('is empty without history', () => {
    expect(getTrend([], today)).toEqual([]);
  });
});

describe(getChange.name, () => {
  it.each([
    { values: [10, 12, 15], expected: 5 },
    { values: [15, 12, 10], expected: -5 },
    { values: [7], expected: 0 },
    { values: [], expected: 0 },
  ])('is $expected for $values', ({ values, expected }) => {
    expect(getChange(values.map((value, index) => ({ date: `2026-11-${10 + index}`, value })))).toBe(expected);
  });
});
