import {
  completeBuild,
  createBuild,
  getBlob,
  setBaseUrl,
  setBearerToken,
  setBuildScreenshots,
  setFetch,
  uploadBlob,
  type BuildCreateDto,
  type DiffDto,
  type ScreenshotDto,
} from '@futo-org/squint-sdk';
import { Constants } from '../constants.js';
import type { ScreenshotTheme } from '../enum.js';
import { HttpRequestError } from '../errors.js';

export type Screenshot = Omit<ScreenshotDto, 'theme'> & { theme: ScreenshotTheme };

export class ApiRepository {
  connect(baseUrl: string, token: string) {
    setBaseUrl(baseUrl);
    setBearerToken(token);
    setFetch(fetchOrFail);
  }

  createBuild(buildCreateDto: BuildCreateDto) {
    return createBuild({ buildCreateDto });
  }

  setScreenshots(id: string, screenshots: Screenshot[]) {
    return setBuildScreenshots({
      id,
      buildScreenshotsDto: {
        screenshots: screenshots.map(({ name, theme, viewport, width, height, sha256 }) => ({
          name,
          theme: theme as string as ScreenshotDto['theme'],
          viewport,
          width,
          height,
          sha256,
        })),
      },
    });
  }

  async uploadBlob(sha256: string, data: Uint8Array<ArrayBuffer>): Promise<void> {
    await uploadBlob({ sha256, body: new Blob([data], { type: Constants.Publish.UploadContentType }) });
  }

  async downloadBlob(sha256: string): Promise<Uint8Array<ArrayBuffer>> {
    const blob = await getBlob({ sha256 });

    return new Uint8Array(await blob.arrayBuffer());
  }

  completeBuild(id: string, diffs: DiffDto[]) {
    return completeBuild({ id, buildCompleteDto: { diffs } });
  }
}

const fetchOrFail = async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await fetch(input, init);
  if (response.ok) {
    return response;
  }

  const method = init?.method ?? 'GET';
  const { pathname } = new URL(input instanceof Request ? input.url : input);
  throw new HttpRequestError(method, pathname, response.status, await getErrorMessage(response));
};

const getErrorMessage = async (response: Response) => {
  const text = await response.text();
  try {
    const { message } = JSON.parse(text) as { message?: unknown };
    return typeof message === 'string' ? message : text;
  } catch {
    return text || response.statusText;
  }
};
