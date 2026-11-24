import { describe, expect, it } from 'vitest';
import { load as loadHistory } from './(app)/projects/[id]/history/+page.js';
import { load as loadScreens } from './(app)/projects/[id]/screens/+page.js';
import { load as loadProject } from './(app)/projects/[id]/+page.js';
import { load as loadBuild } from './builds/[id]/+page.js';

const projectId = '019a8f3e-7b2c-7d4e-9f1a-2b3c4d5e6f71';
const project = { id: projectId, repository: 'immich-app/immich', name: 'web' };

type Route = (path: string) => Response;

const newEvent = (params: Record<string, string>, href: string, route: Route) =>
  ({
    params,
    url: new URL(href, 'https://squint.futo.org'),
    fetch: async (input: RequestInfo | URL) => route(new URL(String(input), 'https://squint.futo.org').pathname),
  }) as never;

const invalid = () => Response.json({ message: 'Validation failed' }, { status: 400 });
const missing = () => Response.json({ message: 'Not Found' }, { status: 404 });
const found = (path: string) => Response.json(path.endsWith('/projects') ? [project] : []);
const empty = () => Response.json([]);

describe('not found', () => {
  it.each([
    { title: 'malformed project id', route: invalid },
    { title: 'unknown project', route: empty },
  ])('sends a $title back to the projects', async ({ route }) => {
    const event = newEvent({ id: 'abc' }, '/projects/abc', route);

    await expect(loadProject(event)).rejects.toMatchObject({ status: 307, location: '/' });
    await expect(loadScreens(event)).rejects.toMatchObject({ status: 307, location: '/' });
    await expect(loadHistory(event)).rejects.toMatchObject({ status: 307, location: '/' });
  });

  it('sends an unknown screen back to the screens of its project', async () => {
    const event = newEvent({ id: projectId }, `/projects/${projectId}/history?screen=gone`, found);

    await expect(loadHistory(event)).rejects.toMatchObject({
      status: 307,
      location: `/projects/${projectId}/screens`,
    });
  });

  it.each([
    { title: 'malformed build id', route: invalid },
    { title: 'unknown build', route: missing },
  ])('sends a $title back to the projects', async ({ route }) => {
    await expect(loadBuild(newEvent({ id: 'abc' }, '/builds/abc', route))).rejects.toMatchObject({
      status: 307,
      location: '/',
    });
  });

  it('still fails when the server fails', async () => {
    const event = newEvent({ id: 'abc' }, '/builds/abc', () => new Response(null, { status: 500 }));

    await expect(loadBuild(event)).rejects.toMatchObject({ status: 500 });
  });
});
