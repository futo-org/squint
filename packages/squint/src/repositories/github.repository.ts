import { readFile } from 'node:fs/promises';
import { SquintError } from '../errors.js';

export type GithubEnv = {
  eventName?: string;
  eventPath?: string;
  ref?: string;
  refName?: string;
  headRef?: string;
  sha?: string;
  tokenUrl?: string;
  tokenRequestToken?: string;
};

export class GithubRepository {
  getEnv(): GithubEnv {
    const { env } = process;

    return {
      eventName: env.GITHUB_EVENT_NAME,
      eventPath: env.GITHUB_EVENT_PATH,
      ref: env.GITHUB_REF,
      refName: env.GITHUB_REF_NAME,
      headRef: env.GITHUB_HEAD_REF,
      sha: env.GITHUB_SHA,
      tokenUrl: env.ACTIONS_ID_TOKEN_REQUEST_URL,
      tokenRequestToken: env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    };
  }

  async readEvent(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8'));
  }

  async getIdToken(url: string, requestToken: string): Promise<string> {
    const response = await fetch(url, { headers: { authorization: `Bearer ${requestToken}` } });
    if (!response.ok) {
      throw new SquintError(`OIDC token request failed with ${response.status}: ${await response.text()}`);
    }

    const { value } = (await response.json()) as { value: string };

    return value;
  }
}
