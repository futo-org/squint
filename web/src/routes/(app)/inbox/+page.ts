import { toBuildFilter } from '#lib/filter.js';
import { searchBranchesQuery, searchBuildsQuery } from '#lib/queries/build.query.js';
import { queryClient } from '#lib/queries/client.js';
import { searchProjectsQuery } from '#lib/queries/project.query.js';
import { ReviewStatus } from '@futo-org/squint-sdk';
import type { PageLoad } from './$types.js';

export const load = (async ({ url }) => {
  const filter = { ...toBuildFilter(url.searchParams), review: ReviewStatus.NeedsReview };
  await Promise.all([
    queryClient.query(searchProjectsQuery()),
    queryClient.query(searchBuildsQuery(filter)),
    queryClient.query(searchBranchesQuery({ review: ReviewStatus.NeedsReview })),
  ]);

  return { filter };
}) satisfies PageLoad;
