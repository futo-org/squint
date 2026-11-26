import { asMutation, queryClient } from '#lib/queries/client.js';
import { QueryKeys } from '#lib/queries/query-keys.js';
import { approveBuildScreen, getBuild, ReviewStatus, revokeBuildScreen, searchBuilds } from '@futo-org/squint-sdk';
import { queryOptions } from '@tanstack/svelte-query';

type BuildParams = Parameters<typeof searchBuilds>[0];

const invalidateBuilds = () => queryClient.invalidateQueries({ queryKey: QueryKeys.builds() });

export const searchBuildsQuery = (params: BuildParams) =>
  queryOptions({
    queryKey: QueryKeys.builds(params),
    queryFn: ({ signal }) => searchBuilds(params, { signal }),
  });

export const searchBranchesQuery = (params: BuildParams) =>
  queryOptions({
    ...searchBuildsQuery(params),
    select: (builds) => [...new Set(builds.map(({ branch }) => branch))].toSorted((a, b) => a.localeCompare(b)),
  });

export const getInboxCountQuery = () =>
  queryOptions({
    ...searchBuildsQuery({ review: ReviewStatus.NeedsReview }),
    select: (builds) => builds.length,
  });

export const getBuildQuery = (id: string) =>
  queryOptions({
    queryKey: QueryKeys.build({ id }),
    queryFn: ({ signal }) => getBuild({ id }, { signal }),
  });

export const approveBuildScreenMutation = () => asMutation(approveBuildScreen, { onSuccess: invalidateBuilds });

export const revokeBuildScreenMutation = () => asMutation(revokeBuildScreen, { onSuccess: invalidateBuilds });
