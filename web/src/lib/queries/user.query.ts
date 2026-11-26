import { QueryKeys } from '#lib/queries/query-keys.js';
import { getMyUser } from '@futo-org/squint-sdk';
import { queryOptions } from '@tanstack/svelte-query';

export const getMyUserQuery = () =>
  queryOptions({
    queryKey: QueryKeys.myUser(),
    queryFn: ({ signal }) => getMyUser({ signal }),
  });
