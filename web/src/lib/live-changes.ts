import { Constants } from './constants.js';

const toSegments = (path: string) => path.split('/').filter(Boolean);

const startsWith = (segments: string[], prefix: string[]) =>
  prefix.length <= segments.length && prefix.every((part, index) => segments[index] === part);

export const isAffected = (url: URL, resource: string) => {
  const [prefix, ...loaded] = toSegments(url.pathname);
  if (prefix !== Constants.Api.Prefix) {
    return false;
  }

  const changed = toSegments(resource);

  return startsWith(loaded, changed) || startsWith(changed, loaded);
};
