import { QueryKeys } from '#lib/queries/query-keys.js';
import { searchScreens, searchScreenshotVersions } from '@futo-org/squint-sdk';
import { queryOptions } from '@tanstack/svelte-query';

type ScreenParams = Parameters<typeof searchScreens>[0];
type ScreenshotVersionParams = Parameters<typeof searchScreenshotVersions>[0];

export const searchScreensQuery = (params: ScreenParams) =>
  queryOptions({
    queryKey: QueryKeys.screens(params),
    queryFn: ({ signal }) => searchScreens(params, { signal }),
  });

export const searchScreenshotVersionsQuery = (params: ScreenshotVersionParams) =>
  queryOptions({
    queryKey: QueryKeys.screenshotVersions(params),
    queryFn: ({ signal }) => searchScreenshotVersions(params, { signal }),
  });
