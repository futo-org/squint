import { toBuildFilter } from '#lib/filter.js';
import { findProjectOrRedirect } from '#lib/load.js';
import { searchBuilds } from '@futo-org/squint-sdk';
import type { PageLoad } from './$types.js';

export const load = (async ({ fetch, params, url }) => {
  const project = await findProjectOrRedirect(params.id, fetch);
  const filter = toBuildFilter(url.searchParams);
  const [builds, allBuilds] = await Promise.all([
    searchBuilds({ projectId: params.id, ...filter }, { fetch }),
    searchBuilds({ projectId: params.id }, { fetch }),
  ]);
  const branches = [...new Set(allBuilds.map(({ branch }) => branch))].toSorted((a, b) => a.localeCompare(b));

  return { project, builds, filter, branches };
}) satisfies PageLoad;
