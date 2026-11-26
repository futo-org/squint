import { findOrRedirect, findProjectOrRedirect } from '#lib/load.js';
import { queryClient } from '#lib/queries/client.js';
import { searchScreenshotVersionsQuery } from '#lib/queries/screen.query.js';
import type { PageLoad } from './$types.js';

export const load = (async ({ params, url }) => {
  await findProjectOrRedirect(params.id);
  const name = url.searchParams.get('screen') ?? '';
  await findOrRedirect(async () => {
    const versions = name ? await queryClient.query(searchScreenshotVersionsQuery({ projectId: params.id, name })) : [];

    return versions.length > 0 ? versions : undefined;
  }, `/projects/${params.id}/screens`);

  return { projectId: params.id, name };
}) satisfies PageLoad;
