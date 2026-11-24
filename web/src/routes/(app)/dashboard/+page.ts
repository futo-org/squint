import { getDashboard, searchProjects } from '@futo-org/squint-sdk';
import type { PageLoad } from './$types.js';

export const load = (async ({ fetch }) => {
  const [dashboard, projects] = await Promise.all([getDashboard({ fetch }), searchProjects({}, { fetch })]);

  return { dashboard, projects };
}) satisfies PageLoad;
