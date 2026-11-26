import type { searchBuilds, searchProjects, searchScreens, searchScreenshotVersions } from '@futo-org/squint-sdk';

type IdParams = { id: string };
type BuildParams = Parameters<typeof searchBuilds>[0];
type ProjectParams = Parameters<typeof searchProjects>[0];
type ScreenParams = Parameters<typeof searchScreens>[0];
type ScreenshotVersionParams = Parameters<typeof searchScreenshotVersions>[0];

export const QueryKeys = {
  // builds
  builds: (...params: [BuildParams?]) => ['builds', ...params],
  build: ({ id }: IdParams) => [...QueryKeys.builds(), id],

  // dashboard
  dashboard: () => ['dashboard'],

  // projects
  projects: (...params: [ProjectParams?]) => ['projects', ...params],

  // releases
  releases: () => ['releases'],

  // screens
  screens: (params: ScreenParams) => ['screens', params],
  screenshotVersions: (params: ScreenshotVersionParams) => ['screenshot-versions', params],

  // server
  serverAbout: () => ['server', 'about'],

  // users
  myUser: () => ['users', 'me'],
};
