import { parseCookie } from 'cookie';
import type { Request } from 'express';

export const getOrigin = (request: Request) => `${request.protocol}://${request.host}`;

export const getCookie = (header: string | undefined, name: string) => parseCookie(header ?? '')[name];
