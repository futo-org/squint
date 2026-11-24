import { getMyUser, isHttpError } from '@futo-org/squint-sdk';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types.js';

export const ssr = false;

export const load = (async ({ fetch, url }) => {
  try {
    return { user: await getMyUser({ fetch }) };
  } catch (error_) {
    if (isHttpError(error_) && error_.status === 401) {
      redirect(307, `/api/auth/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`);
    }

    error(isHttpError(error_) ? error_.status : 500, 'Unable to load the signed in user');
  }
}) satisfies LayoutLoad;
