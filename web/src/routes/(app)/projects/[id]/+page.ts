import { toBuildFilter } from '#lib/filter.js';
import { findProjectOrRedirect } from '#lib/load.js';
import { searchBranchesQuery, searchBuildsQuery } from '#lib/queries/build.query.js';
import { queryClient } from '#lib/queries/client.js';
import type { PageLoad } from './$types.js';

export const load = (async ({ params, url }) => {
  await findProjectOrRedirect(params.id);
  const filter = toBuildFilter(url.searchParams);
  await Promise.all([
    queryClient.query(searchBuildsQuery({ projectId: params.id, ...filter })),
    queryClient.query(searchBranchesQuery({ projectId: params.id })),
  ]);

  return { projectId: params.id, filter };
}) satisfies PageLoad;
