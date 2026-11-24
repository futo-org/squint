import { describe, expect, it } from 'vitest';
import { getUnseenReleases, isNewerVersion } from './version.js';

describe(isNewerVersion.name, () => {
  it.each([
    { candidate: '0.2.0', current: '0.1.0', expected: true },
    { candidate: '0.10.0', current: '0.9.0', expected: true },
    { candidate: '1.0.0', current: '0.99.99', expected: true },
    { candidate: '0.1.1', current: '0.1', expected: true },
    { candidate: '0.1.0', current: '0.1.0', expected: false },
    { candidate: '0.1.0', current: '0.2.0', expected: false },
    { candidate: 'unknown', current: '0.0.1', expected: false },
  ])('$candidate is newer than $current: $expected', ({ candidate, current, expected }) => {
    expect(isNewerVersion(candidate, current)).toBe(expected);
  });
});

describe(getUnseenReleases.name, () => {
  const releases = ['0.4.0', '0.3.0', '0.2.0', '0.1.0'].map((version) => ({ version }));

  it('returns the releases after the last seen version up to the running one', () => {
    expect(getUnseenReleases(releases, { lastSeen: '0.1.0', current: '0.3.0' })).toEqual([
      { version: '0.3.0' },
      { version: '0.2.0' },
    ]);
  });

  it('returns nothing when the running version was already seen', () => {
    expect(getUnseenReleases(releases, { lastSeen: '0.3.0', current: '0.3.0' })).toEqual([]);
  });

  it('returns nothing after a downgrade', () => {
    expect(getUnseenReleases(releases, { lastSeen: '0.4.0', current: '0.2.0' })).toEqual([]);
  });
});
