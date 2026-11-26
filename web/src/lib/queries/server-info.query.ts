import { QueryKeys } from '#lib/queries/query-keys.js';
import { getServerAbout, searchReleases } from '@futo-org/squint-sdk';
import { queryOptions } from '@tanstack/svelte-query';

export const getServerAboutQuery = () =>
  queryOptions({
    queryKey: QueryKeys.serverAbout(),
    queryFn: ({ signal }) => getServerAbout({ signal }),
  });

export const searchReleasesQuery = () =>
  queryOptions({
    queryKey: QueryKeys.releases(),
    queryFn: ({ signal }) => searchReleases({ signal }),
  });
