import { findProjectOrRedirect } from '#lib/load.js';
import { queryClient } from '#lib/queries/client.js';
import { searchScreensQuery } from '#lib/queries/screen.query.js';
import type { PageLoad } from './$types.js';

export const load = (async ({ params, url }) => {
  await findProjectOrRedirect(params.id);
  const query = url.searchParams.get('query')?.trim() || undefined;
  await queryClient.query(searchScreensQuery({ projectId: params.id, query }));

  return { projectId: params.id, query };
}) satisfies PageLoad;
