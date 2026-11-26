import { getInboxCountQuery } from '#lib/queries/build.query.js';
import { queryClient } from '#lib/queries/client.js';
import { getServerAboutQuery } from '#lib/queries/server-info.query.js';
import type { LayoutLoad } from './$types.js';

export const load = (async () => {
  await Promise.all([queryClient.query(getServerAboutQuery()), queryClient.query(getInboxCountQuery())]);
}) satisfies LayoutLoad;
