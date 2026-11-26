import { describe, expect, it } from 'vitest';
import { isAffected } from './live-changes.js';

describe(isAffected.name, () => {
  it.each([
    { queryKey: ['builds'], resource: '/builds', expected: true },
    { queryKey: ['builds', { projectId: 'project-1' }], resource: '/builds', expected: true },
    { queryKey: ['builds', 'build-1'], resource: '/builds', expected: true },
    { queryKey: ['builds'], resource: '/builds/build-1', expected: true },
    { queryKey: ['builds', { review: 'needs-review' }], resource: '/builds/build-1', expected: true },
    { queryKey: ['builds', 'build-1'], resource: '/builds/build-1', expected: true },
    { queryKey: ['builds', 'build-2'], resource: '/builds/build-1', expected: false },
    { queryKey: ['projects'], resource: '/builds', expected: false },
    { queryKey: ['builds-archive'], resource: '/builds', expected: false },
    { queryKey: ['screenshot-versions', { name: 'home' }], resource: '/screenshot-versions', expected: true },
    { queryKey: ['users', 'me'], resource: '/', expected: true },
  ])('$resource changed, $queryKey refetches: $expected', ({ queryKey, resource, expected }) => {
    expect(isAffected(queryKey, resource)).toBe(expected);
  });
});
