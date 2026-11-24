import { ScreenshotTheme } from './enum.js';

export const Constants = {
  Regions: {
    CellSize: 16,
    MaxRegions: 20,
  },
  Manifest: {
    FileName: 'manifest.json',
    Themes: new Set<string>(Object.values(ScreenshotTheme)),
  },
  Publish: {
    DefaultServer: 'https://squint.futo.org/api',
    ServerEnv: 'SQUINT_SERVER',
    Audience: 'squint.futo.org',
    UploadContentType: 'application/octet-stream',
    TempPrefix: 'squint-publish-',
  },
  Cli: {
    Usage: 'Usage: squint publish <dir> --project <slug> [--release <name>] [--server <url>]',
  },
  Playwright: {
    AttachmentPrefix: 'squint',
    AttachmentSeparator: ':',
    ContentType: 'image/png',
    OutputDir: 'squint-report',
    DefaultViewport: 'default',
    FileExtension: '.png',
    ScreenshotOptions: { fullPage: true, animations: 'disabled' } as const,
  },
  Github: {
    PullRequestEvents: new Set(['pull_request', 'pull_request_target']),
    PullRequestRef: /^refs\/pull\/(\d+)\/merge$/,
  },
};
