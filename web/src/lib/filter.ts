import { BuildKind, PullRequestState, ReviewStatus } from '@futo-org/squint-sdk';

export type BuildFilter = {
  query?: string;
  review?: ReviewStatus;
  kind?: BuildKind;
  pullRequestState?: PullRequestState;
  branch?: string;
};

export type ProjectFilter = { query?: string; repository?: string };

const getText = (params: URLSearchParams, name: string) => params.get(name)?.trim() || undefined;

const getEnum = <T extends string>(params: URLSearchParams, name: string, values: Record<string, T>) => {
  const value = params.get(name) as T;

  return Object.values(values).includes(value) ? value : undefined;
};

const compact = <T extends Record<string, string | undefined>>(filter: T) =>
  Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined)) as T;

export const toBuildFilter = (params: URLSearchParams): BuildFilter =>
  compact({
    query: getText(params, 'query'),
    review: getEnum(params, 'review', ReviewStatus),
    kind: getEnum(params, 'kind', BuildKind),
    pullRequestState: getEnum(params, 'pullRequestState', PullRequestState),
    branch: getText(params, 'branch'),
  });

export const toProjectFilter = (params: URLSearchParams): ProjectFilter =>
  compact({ query: getText(params, 'query'), repository: getText(params, 'repository') });

export const toSearch = (filter: Record<string, string | undefined>) => {
  const search = new URLSearchParams(Object.entries(compact(filter)) as Array<[string, string]>).toString();

  return search ? `?${search}` : '';
};
