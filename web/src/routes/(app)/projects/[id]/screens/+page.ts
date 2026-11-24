import { findProjectOrRedirect } from '#lib/load.js';
import { searchScreens } from '@futo-org/squint-sdk';
import type { PageLoad } from './$types.js';

export const load = (async ({ fetch, params, url }) => {
  const project = await findProjectOrRedirect(params.id, fetch);
  const query = url.searchParams.get('query')?.trim() || undefined;
  const screens = await searchScreens({ projectId: params.id, query }, { fetch });

  return { project, screens, query };
}) satisfies PageLoad;
