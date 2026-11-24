import { toBuildFilter } from '#lib/filter.js';
import { searchBuilds, searchProjects } from '@futo-org/squint-sdk';
import type { PageLoad } from './$types.js';

export const load = (async ({ fetch, url }) => {
  const { review: _review, ...filter } = toBuildFilter(url.searchParams);
  const [projects, builds, allBuilds] = await Promise.all([
    searchProjects({}, { fetch }),
    searchBuilds({ ...filter, isTrashed: true }, { fetch }),
    searchBuilds({ isTrashed: true }, { fetch }),
  ]);
  const branches = [...new Set(allBuilds.map(({ branch }) => branch))].toSorted((a, b) => a.localeCompare(b));
  const projectNames = Object.fromEntries(projects.map(({ id, name }) => [id, name]));

  return { builds, filter, branches, projectNames };
}) satisfies PageLoad;
