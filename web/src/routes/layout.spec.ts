import { queryClient } from '#lib/queries/client.js';
import { getMyUserQuery } from '#lib/queries/user.query.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+layout.js';

const newEvent = (response: Response, href = 'https://squint.futo.org/') => {
  vi.stubGlobal('fetch', async () => response);

  return { url: new URL(href) } as unknown as Parameters<typeof load>[0];
};

describe('layout load', () => {
  beforeEach(() => queryClient.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('loads the signed in user', async () => {
    const user = { id: 'user-1', email: 'approver@immich.app', name: 'Approver', role: 'approver', avatarUrl: null };

    await load(newEvent(Response.json(user)));

    expect(queryClient.getQueryData(getMyUserQuery().queryKey)).toEqual(user);
  });

  it('sends a signed out visitor to login and back to the same page', async () => {
    const event = newEvent(new Response(null, { status: 401 }), 'https://squint.futo.org/builds?page=2');

    await expect(load(event)).rejects.toMatchObject({
      status: 307,
      location: '/api/auth/login?returnTo=%2Fbuilds%3Fpage%3D2',
    });
  });

  it('fails when the user cannot be loaded', async () => {
    const event = newEvent(new Response(null, { status: 500 }));

    await expect(load(event)).rejects.toMatchObject({ status: 500 });
  });
});
