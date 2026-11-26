import type { QueryKey } from '@tanstack/svelte-query';

const toSegments = (path: string) => path.split('/').filter(Boolean);

const getResourcePath = (queryKey: QueryKey) => {
  const end = queryKey.findIndex((part) => typeof part !== 'string');

  return queryKey.slice(0, end === -1 ? undefined : end) as string[];
};

const startsWith = (segments: string[], prefix: string[]) =>
  prefix.length <= segments.length && prefix.every((part, index) => segments[index] === part);

export const isAffected = (queryKey: QueryKey, resource: string) => {
  const loaded = getResourcePath(queryKey);
  const changed = toSegments(resource);

  return startsWith(loaded, changed) || startsWith(changed, loaded);
};
