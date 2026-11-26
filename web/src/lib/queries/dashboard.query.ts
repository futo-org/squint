import { QueryKeys } from '#lib/queries/query-keys.js';
import { getDashboard } from '@futo-org/squint-sdk';
import { queryOptions } from '@tanstack/svelte-query';

export const getDashboardQuery = () =>
  queryOptions({
    queryKey: QueryKeys.dashboard(),
    queryFn: ({ signal }) => getDashboard({ signal }),
  });
