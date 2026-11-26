import { toBuildFilter } from '#lib/filter.js';
import { searchBranchesQuery, searchBuildsQuery } from '#lib/queries/build.query.js';
import { queryClient } from '#lib/queries/client.js';
import { searchProjectsQuery } from '#lib/queries/project.query.js';
import type { PageLoad } from './$types.js';

export const load = (async ({ url }) => {
  const { review: _review, ...filter } = toBuildFilter(url.searchParams);
  await Promise.all([
    queryClient.query(searchProjectsQuery()),
    queryClient.query(searchBuildsQuery({ ...filter, isTrashed: true })),
    queryClient.query(searchBranchesQuery({ isTrashed: true })),
  ]);

  return { filter };
}) satisfies PageLoad;
