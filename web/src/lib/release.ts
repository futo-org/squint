import { modalManager } from '@immich/ui';
import { queryClient } from '#lib/queries/client.js';
import { searchReleasesQuery } from '#lib/queries/server-info.query.js';
import { Constants } from './constants.js';
import WhatsNewModal from './modals/WhatsNewModal.svelte';
import { getUnseenReleases } from './version.js';

export const handleShowWhatsNew = async () => {
  await modalManager.show(WhatsNewModal, { releases: await queryClient.query(searchReleasesQuery()) });
};

export const handleShowUnseenReleases = async (current: string) => {
  const lastSeen = localStorage.getItem(Constants.LastSeenVersionKey);
  localStorage.setItem(Constants.LastSeenVersionKey, current);
  if (!lastSeen) {
    return;
  }

  const releases = getUnseenReleases(await queryClient.query(searchReleasesQuery()), { lastSeen, current });
  if (releases.length > 0) {
    await modalManager.show(WhatsNewModal, { releases });
  }
};
