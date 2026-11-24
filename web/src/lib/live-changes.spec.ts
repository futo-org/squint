import { describe, expect, it } from 'vitest';
import { isAffected } from './live-changes.js';

const origin = 'https://squint.futo.org';

describe(isAffected.name, () => {
  it.each([
    { loaded: '/api/builds', resource: '/builds', expected: true },
    { loaded: '/api/builds?projectId=project-1', resource: '/builds', expected: true },
    { loaded: '/api/builds/build-1', resource: '/builds', expected: true },
    { loaded: '/api/builds', resource: '/builds/build-1', expected: true },
    { loaded: '/api/builds/build-1', resource: '/builds/build-1', expected: true },
    { loaded: '/api/builds/build-2', resource: '/builds/build-1', expected: false },
    { loaded: '/api/projects', resource: '/builds', expected: false },
    { loaded: '/api/builds-archive', resource: '/builds', expected: false },
    { loaded: '/builds/build-1', resource: '/builds', expected: false },
    { loaded: '/api/users/me', resource: '/', expected: true },
  ])('$resource changed, $loaded reloads: $expected', ({ loaded, resource, expected }) => {
    expect(isAffected(new URL(loaded, origin), resource)).toBe(expected);
  });
});
