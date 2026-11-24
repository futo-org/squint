import { HttpError } from '@oazapfts/runtime';
import { defaults } from './fetch-client.js';

export * from './fetch-client.js';

export const setBaseUrl = (baseUrl: string) => {
  defaults.baseUrl = baseUrl;
};

export const setFetch = (fetch: typeof globalThis.fetch) => {
  defaults.fetch = fetch;
};

export const setBearerToken = (token: string) => {
  defaults.headers = { ...defaults.headers, authorization: `Bearer ${token}` };
};

export const getBlobPath = (sha256: string) => `${defaults.baseUrl}/blobs/${sha256}`;

export const isHttpError = (error: unknown): error is HttpError => error instanceof HttpError;
