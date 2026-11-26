import { queryClient } from '#lib/queries/client.js';
import { getDashboardQuery } from '#lib/queries/dashboard.query.js';
import { searchProjectsQuery } from '#lib/queries/project.query.js';
import type { PageLoad } from './$types.js';

export const load = (async () => {
  await Promise.all([queryClient.query(getDashboardQuery()), queryClient.query(searchProjectsQuery())]);
}) satisfies PageLoad;
