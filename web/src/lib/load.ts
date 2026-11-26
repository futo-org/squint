import { queryClient } from '#lib/queries/client.js';
import { getProjectQuery } from '#lib/queries/project.query.js';
import { isHttpError } from '@futo-org/squint-sdk';
import { redirect } from '@sveltejs/kit';
import { Constants } from './constants.js';

const isNotFound = (error: unknown) => isHttpError(error) && Constants.NotFoundStatuses.has(error.status);

export const findOrRedirect = async <T>(load: () => Promise<T | undefined>, href: string): Promise<T> => {
  let result: T | undefined;
  try {
    result = await load();
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  if (result === undefined) {
    redirect(307, href);
  }

  return result;
};

export const findProjectOrRedirect = (id: string) => findOrRedirect(() => queryClient.query(getProjectQuery(id)), '/');
