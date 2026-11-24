import { vi } from 'vitest';

export type FakeServer = { handle: (request: Request) => Response | Promise<Response> | undefined };

export const fakeFetch = (...servers: FakeServer[]) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    for (const server of servers) {
      const response = await server.handle(request);
      if (response) {
        return response;
      }
    }

    throw new Error(`Unexpected request: ${request.method} ${request.url}`);
  });
