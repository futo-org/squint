import { describe, expect, it } from 'vitest';
import { getTimeline, getVariants } from './history.js';

const newVersion = (id: string, theme: string, viewport: string) => ({ id, theme, viewport });

const versions = [
  newVersion('4', 'light', 'desktop'),
  newVersion('3', 'dark', 'desktop'),
  newVersion('2', 'light', 'phone'),
  newVersion('1', 'light', 'desktop'),
];

describe(getVariants.name, () => {
  it('lists each theme and viewport once', () => {
    expect(getVariants(versions)).toEqual({ themes: ['light', 'dark'], viewports: ['desktop', 'phone'] });
  });
});

describe(getTimeline.name, () => {
  it('keeps the versions of the chosen theme and viewport, newest first', () => {
    const timeline = getTimeline(versions, { theme: 'light', viewport: 'desktop' });

    expect(timeline.map(({ id }) => id)).toEqual(['4', '1']);
  });

  it('falls back to the first viewport that has the theme', () => {
    const timeline = getTimeline(versions, { theme: 'dark', viewport: 'phone' });

    expect(timeline.map(({ id }) => id)).toEqual(['3']);
  });

  it('falls back to the newest version when nothing was chosen', () => {
    const timeline = getTimeline(versions, {});

    expect(timeline.map(({ id }) => id)).toEqual(['4', '1']);
  });

  it('is empty without versions', () => {
    expect(getTimeline([], { theme: 'light', viewport: 'desktop' })).toEqual([]);
  });
});
