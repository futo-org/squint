import {
  createQuery,
  mutationOptions,
  QueryClient,
  type CreateMutationOptions,
  type DefaultError,
  type DefinedCreateQueryResult,
  type NonUndefinedGuard,
  type QueryKey,
  type UndefinedInitialDataOptions,
} from '@tanstack/svelte-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

export const asMutation = <TArgs extends unknown[], TData, TError = DefaultError>(
  fn: (...args: TArgs) => Promise<TData>,
  options?: Omit<CreateMutationOptions<TData, TError, TArgs>, 'mutationFn'>,
) => mutationOptions({ ...options, mutationFn: (args: TArgs) => fn(...args) });

const getPreloadedData = <TQueryFnData>(queryKey: QueryKey) => {
  const data = queryClient.getQueryData<TQueryFnData, QueryKey, NonUndefinedGuard<TQueryFnData>>(queryKey);
  if (data === undefined) {
    throw new Error(`${JSON.stringify(queryKey)} must be loaded first`);
  }

  return data;
};

export const createPreloadedQuery = <TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  optionsFn: () => UndefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
): DefinedCreateQueryResult<TData, TError> =>
  createQuery(
    () => {
      const options = optionsFn();

      return { ...options, initialData: getPreloadedData<TQueryFnData>(options.queryKey) };
    },
    () => queryClient,
  );
