import { QueryKeys } from '#lib/queries/query-keys.js';
import { searchProjects } from '@futo-org/squint-sdk';
import { queryOptions } from '@tanstack/svelte-query';

type ProjectParams = Parameters<typeof searchProjects>[0];

export const searchProjectsQuery = (...params: [ProjectParams?]) =>
  queryOptions({
    queryKey: QueryKeys.projects(...params),
    queryFn: ({ signal }) => searchProjects(params[0] ?? {}, { signal }),
  });

export const getProjectQuery = (id: string) =>
  queryOptions({
    ...searchProjectsQuery({ id }),
    select: ([project]) => project,
  });
