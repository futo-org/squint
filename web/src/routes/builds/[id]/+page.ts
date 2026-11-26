import { findOrRedirect } from '#lib/load.js';
import { getBuildQuery } from '#lib/queries/build.query.js';
import { queryClient } from '#lib/queries/client.js';
import type { PageLoad } from './$types.js';

export const load = (async ({ params }) => {
  await findOrRedirect(() => queryClient.query(getBuildQuery(params.id)), '/');

  return { id: params.id };
}) satisfies PageLoad;
