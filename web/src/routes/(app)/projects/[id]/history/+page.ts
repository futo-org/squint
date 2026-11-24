import { findOrRedirect, findProjectOrRedirect } from '#lib/load.js';
import { searchScreenshotVersions } from '@futo-org/squint-sdk';
import type { PageLoad } from './$types.js';

export const load = (async ({ fetch, params, url }) => {
  const project = await findProjectOrRedirect(params.id, fetch);
  const name = url.searchParams.get('screen') ?? '';
  const versions = await findOrRedirect(async () => {
    const versions = name ? await searchScreenshotVersions({ projectId: params.id, name }, { fetch }) : [];

    return versions.length > 0 ? versions : undefined;
  }, `/projects/${params.id}/screens`);

  return { project, name, versions };
}) satisfies PageLoad;
