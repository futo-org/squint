import { toProjectFilter } from '#lib/filter.js';
import { searchProjects } from '@futo-org/squint-sdk';
import type { PageLoad } from './$types.js';

export const load = (async ({ fetch, url }) => {
  const filter = toProjectFilter(url.searchParams);
  const [projects, allProjects] = await Promise.all([searchProjects(filter, { fetch }), searchProjects({}, { fetch })]);
  const repositories = [...new Set(allProjects.map(({ repository }) => repository))];

  return { projects, filter, repositories };
}) satisfies PageLoad;
