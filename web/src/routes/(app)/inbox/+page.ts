import { toBuildFilter } from '#lib/filter.js';
import { ReviewStatus, searchBuilds, searchProjects } from '@futo-org/squint-sdk';
import type { PageLoad } from './$types.js';

export const load = (async ({ fetch, url }) => {
  const filter = { ...toBuildFilter(url.searchParams), review: ReviewStatus.NeedsReview };
  const [projects, builds, allBuilds] = await Promise.all([
    searchProjects({}, { fetch }),
    searchBuilds(filter, { fetch }),
    searchBuilds({ review: ReviewStatus.NeedsReview }, { fetch }),
  ]);
  const branches = [...new Set(allBuilds.map(({ branch }) => branch))].toSorted((a, b) => a.localeCompare(b));
  const projectNames = Object.fromEntries(projects.map(({ id, name }) => [id, name]));

  return { builds, filter, branches, projectNames };
}) satisfies PageLoad;
