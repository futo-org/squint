import { findOrRedirect } from '#lib/load.js';
import { getBuild } from '@futo-org/squint-sdk';
import type { PageLoad } from './$types.js';

export const load = (async ({ fetch, params }) => ({
  build: await findOrRedirect(() => getBuild({ id: params.id }, { fetch }), '/'),
})) satisfies PageLoad;
