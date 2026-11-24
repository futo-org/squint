import { getServerAbout, ReviewStatus, searchBuilds } from '@futo-org/squint-sdk';
import type { LayoutLoad } from './$types.js';

export const load = (async ({ fetch }) => {
  const [about, inbox] = await Promise.all([
    getServerAbout({ fetch }),
    searchBuilds({ review: ReviewStatus.NeedsReview }, { fetch }),
  ]);

  return { about, inboxCount: inbox.length };
}) satisfies LayoutLoad;
