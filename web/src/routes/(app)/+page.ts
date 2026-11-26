import { toProjectFilter } from '#lib/filter.js';
import { queryClient } from '#lib/queries/client.js';
import { searchProjectsQuery } from '#lib/queries/project.query.js';
import type { PageLoad } from './$types.js';

export const load = (async ({ url }) => {
  const filter = toProjectFilter(url.searchParams);
  await Promise.all([queryClient.query(searchProjectsQuery(filter)), queryClient.query(searchProjectsQuery())]);

  return { filter };
}) satisfies PageLoad;
