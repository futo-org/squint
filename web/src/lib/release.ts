import { modalManager } from '@immich/ui';
import { searchReleases } from '@futo-org/squint-sdk';
import { Constants } from './constants.js';
import WhatsNewModal from './modals/WhatsNewModal.svelte';
import { getUnseenReleases } from './version.js';

export const handleShowWhatsNew = async () => {
  await modalManager.show(WhatsNewModal, { releases: await searchReleases() });
};

export const handleShowUnseenReleases = async (current: string) => {
  const lastSeen = localStorage.getItem(Constants.LastSeenVersionKey);
  localStorage.setItem(Constants.LastSeenVersionKey, current);
  if (!lastSeen) {
    return;
  }

  const releases = getUnseenReleases(await searchReleases(), { lastSeen, current });
  if (releases.length > 0) {
    await modalManager.show(WhatsNewModal, { releases });
  }
};
