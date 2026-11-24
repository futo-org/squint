export class SquintError extends Error {
  name = 'SquintError';
}

export class HttpRequestError extends SquintError {
  name = 'HttpRequestError';

  constructor(method: string, path: string, status: number, message: string) {
    super(`${method} ${path} failed with ${status}: ${message}`);
  }
}
