import { describe, expect, it } from 'vitest';
import {
  getNextScreen,
  getNextToReview,
  getScreenApproval,
  groupScreens,
  pickVariant,
  type Screenshot,
} from './screens.js';

const newScreenshot = (overrides: Partial<Record<keyof Screenshot, unknown>>) =>
  ({
    id: 'id',
    name: 'button',
    theme: 'light',
    viewport: 'desktop',
    width: 1280,
    height: 720,
    status: 'unchanged',
    sha256: 'after',
    baselineSha256: 'before',
    diffSha256: null,
    diffRatio: null,
    approval: null,
    ...overrides,
  }) as Screenshot;

const approval = { userId: 'user-1', userName: 'Approver', createdAt: '2026-11-17T00:00:00.000Z' };

describe(groupScreens.name, () => {
  it('groups the themes and viewports of a screen together', () => {
    const screens = groupScreens([
      newScreenshot({ id: '1', name: 'button', theme: 'light', status: 'changed' }),
      newScreenshot({ id: '2', name: 'button', theme: 'dark', status: 'changed' }),
      newScreenshot({ id: '3', name: 'alert', status: 'new' }),
    ]);

    expect(screens.map(({ name, variants }) => ({ name, ids: variants.map(({ id }) => id) }))).toEqual([
      { name: 'alert', ids: ['3'] },
      { name: 'button', ids: ['1', '2'] },
    ]);
  });

  it.each([
    { statuses: ['unchanged', 'changed', 'new'], expected: 'changed' },
    { statuses: ['unchanged', 'new'], expected: 'new' },
    { statuses: ['unchanged', 'removed'], expected: 'removed' },
  ])('reports $expected for a screen with $statuses', ({ statuses, expected }) => {
    const variants = statuses.map((status, index) =>
      newScreenshot({ id: String(index), viewport: `v${index}`, status }),
    );

    expect(groupScreens(variants)[0].status).toBe(expected);
  });

  it('counts what still needs review', () => {
    const [screen] = groupScreens([
      newScreenshot({ id: '1', theme: 'light', status: 'changed', approval }),
      newScreenshot({ id: '2', theme: 'dark', status: 'changed' }),
      newScreenshot({ id: '3', viewport: 'phone', status: 'unchanged' }),
    ]);

    expect(screen.pending).toBe(1);
  });

  it('leaves out screens with no changes', () => {
    const screens = groupScreens([
      newScreenshot({ id: '1', name: 'alert', status: 'unchanged' }),
      newScreenshot({ id: '2', name: 'button', theme: 'light', status: 'unchanged' }),
      newScreenshot({ id: '3', name: 'button', theme: 'dark', status: 'changed' }),
    ]);

    expect(screens.map(({ name, variants }) => ({ name, ids: variants.map(({ id }) => id) }))).toEqual([
      { name: 'button', ids: ['2', '3'] },
    ]);
  });

  it('lists screens in the order of the tree beside them', () => {
    const screens = groupScreens([
      newScreenshot({ id: '1', name: 'root', status: 'changed' }),
      newScreenshot({ id: '2', name: 'pages/b', status: 'new' }),
      newScreenshot({ id: '3', name: 'pages/a', status: 'changed' }),
    ]);

    expect(screens.map(({ name }) => name)).toEqual(['pages/a', 'pages/b', 'root']);
  });
});

describe(pickVariant.name, () => {
  const [screen] = groupScreens([
    newScreenshot({ id: 'light-desktop', theme: 'light', viewport: 'desktop', status: 'changed' }),
    newScreenshot({ id: 'dark-desktop', theme: 'dark', viewport: 'desktop' }),
    newScreenshot({ id: 'light-phone', theme: 'light', viewport: 'phone' }),
  ]);

  it('picks the requested theme and viewport', () => {
    expect(pickVariant(screen, { theme: 'dark', viewport: 'desktop' }).id).toBe('dark-desktop');
  });

  it('keeps the viewport when the theme is missing', () => {
    expect(pickVariant(screen, { theme: 'dark', viewport: 'phone' }).id).toBe('light-phone');
  });

  it('falls back to the first variant', () => {
    expect(pickVariant(screen, { theme: 'dark', viewport: 'tablet' }).id).toBe('light-desktop');
  });
});

describe(getNextToReview.name, () => {
  const screens = groupScreens([
    newScreenshot({ id: '1', name: 'alert', status: 'changed', approval }),
    newScreenshot({ id: '2', name: 'button', status: 'changed' }),
    newScreenshot({ id: '3', name: 'card', status: 'new' }),
    newScreenshot({ id: '4', name: 'input', status: 'unchanged' }),
  ]);

  it('finds the next screen that still needs approval', () => {
    expect(getNextToReview(screens, 'button')?.name).toBe('card');
  });

  it('wraps around to earlier screens', () => {
    expect(getNextToReview(screens, 'card')?.name).toBe('button');
  });

  it('returns nothing when every other screen is approved', () => {
    const done = groupScreens([
      newScreenshot({ id: '1', name: 'alert', status: 'changed', approval }),
      newScreenshot({ id: '2', name: 'button', status: 'changed' }),
    ]);

    expect(getNextToReview(done, 'button')).toBeUndefined();
  });
});

describe(getScreenApproval.name, () => {
  const earlier = { userId: 'user-1', userName: 'First', createdAt: '2026-11-16T00:00:00.000Z' };
  const later = { userId: 'user-2', userName: 'Second', createdAt: '2026-11-17T00:00:00.000Z' };

  it('reports the latest approval once every changed theme is approved', () => {
    const [screen] = groupScreens([
      newScreenshot({ id: '1', theme: 'light', status: 'changed', approval: earlier }),
      newScreenshot({ id: '2', theme: 'dark', status: 'changed', approval: later }),
      newScreenshot({ id: '3', viewport: 'phone', status: 'unchanged' }),
    ]);

    expect(getScreenApproval(screen)).toEqual(later);
  });

  it('reports nothing while a changed theme is not approved', () => {
    const [screen] = groupScreens([
      newScreenshot({ id: '1', theme: 'light', status: 'changed', approval: earlier }),
      newScreenshot({ id: '2', theme: 'dark', status: 'changed' }),
    ]);

    expect(getScreenApproval(screen)).toBeUndefined();
  });
});

describe(getNextScreen.name, () => {
  const screens = groupScreens([
    newScreenshot({ id: '1', name: 'alert', status: 'changed' }),
    newScreenshot({ id: '2', name: 'button', status: 'changed', approval }),
    newScreenshot({ id: '3', name: 'card', status: 'new', approval }),
  ]);

  it('advances to the following screen', () => {
    expect(getNextScreen(screens, 'button', { isApproving: false })?.name).toBe('card');
  });

  it('returns nothing after the last screen', () => {
    expect(getNextScreen(screens, 'card', { isApproving: false })).toBeUndefined();
  });

  it('goes to the next screen that needs approval when approving', () => {
    expect(getNextScreen(screens, 'card', { isApproving: true })?.name).toBe('alert');
  });

  it('returns nothing when approving the last pending screen', () => {
    expect(getNextScreen(screens, 'alert', { isApproving: true })).toBeUndefined();
  });
});
