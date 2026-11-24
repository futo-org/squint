# Squint

Visual regression review for screenshot tests, served at https://squint.futo.org/

- `web`: the web app (SvelteKit, static build)
- `server`: the API (NestJS, Postgres through Kysely, schema managed with `@immich/sql-tools`)
- `open-api`: the OpenAPI specification the API generates
- `packages/sdk`: the TypeScript client generated from that specification
- `packages/squint`: the screenshot diff tool

## Development

```
docker compose up database storage-bucket # Postgres on :5432, S3 storage on :9000
pnpm --filter squint-server run start:dev # API on :3000
pnpm --filter squint-web run start        # web on :5173, proxies /api to :3000
```

The API reads its settings from the environment and refuses to start when one is missing or invalid:

| Variable                                                                     | Default                                                                 |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `SQUINT_DB_URL`                                                              | `postgres://postgres:postgres@localhost:5432/squint`                    |
| `SQUINT_HOST`, `SQUINT_PORT`                                                 | all interfaces, `3000`                                                  |
| `SQUINT_WEB_ROOT`                                                            | the web app's `build` folder                                            |
| `SQUINT_TRUSTED_PROXIES`                                                     | `loopback,linklocal,uniquelocal`                                        |
| `SQUINT_S3_BUCKET`, `SQUINT_S3_ACCESS_KEY_ID`, `SQUINT_S3_SECRET_ACCESS_KEY` | required, screenshots are stored in this bucket                         |
| `SQUINT_S3_ENDPOINT`                                                         | none, set it for S3 compatible storage                                  |
| `SQUINT_S3_REGION`                                                           | `us-east-1`                                                             |
| `SQUINT_S3_FORCE_PATH_STYLE`                                                 | `false`                                                                 |
| `SQUINT_OAUTH_ISSUER`                                                        | `https://auth.internal.futo.org`                                        |
| `SQUINT_OAUTH_CLIENT_ID`, `SQUINT_OAUTH_CLIENT_SECRET`                       | none, the Squint Dev client is in 1Password                             |
| `SQUINT_GITHUB_OIDC_ISSUER`                                                  | `https://token.actions.githubusercontent.com`                           |
| `SQUINT_GITHUB_WEBHOOK_SECRET`                                               | none, every webhook delivery is refused without it                      |
| `SQUINT_CI_OWNERS`                                                           | `futo-org,immich-app`, comma separated GitHub owners allowed to publish |

## Database

Tables live in `server/src/schema/tables`. After changing one, build and generate a migration against a database that has the previous migrations applied:

```
pnpm --filter squint-server run build
pnpm --filter squint-server run migrations:generate src/schema/migrations/<Name>
```

The server applies pending migrations when it starts.

## API client

After changing a controller or a DTO, regenerate the specification and the client:

```
pnpm --filter squint-server run build
pnpm --filter squint-server run open-api
pnpm --filter @futo-org/squint-sdk run generate
```

## Builds

CI publishes three kinds of builds. A `main` build comes from a workflow on `main` and is compared with the previous main build. A `pull-request` build is compared with the latest main build. A `release` build comes from a workflow on a tag, carries a release name such as `v2.3.0`, and is compared with the previous release.

## Publishing screenshots

A project publishes screenshots from its Playwright tests with `@futo-org/squint`. Take each screenshot with the `screenshot` helper and add the reporter, which writes the screenshots and a `manifest.json` to `squint-report`:

```ts
// playwright.config.ts
export default defineConfig({
  reporter: [['list'], ['@futo-org/squint/playwright', { outputDir: 'squint-report' }]],
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    {
      name: 'mobile-dark',
      use: { viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
      metadata: { squint: { viewport: 'mobile' } },
    },
  ],
});

// home.spec.ts
import { screenshot } from '@futo-org/squint/playwright';

test('home', async ({ page }, testInfo) => {
  await page.goto('/');
  await screenshot(page, testInfo, 'home');
});
```

The theme comes from `colorScheme` (light when unset) and the viewport from `metadata.squint.viewport`, or the project name.

Then publish the report from CI. The job needs `id-token: write` so the CLI can sign in with a GitHub OIDC token. Pushes to `main` publish a main build, pull requests publish a pull request build, and a tag job publishes a release:

```yaml
permissions:
  contents: read
  id-token: write

jobs:
  squint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: npm ci && npx playwright test
      - run: npx squint publish squint-report --project web

  release:
    if: startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - run: npm ci && npx playwright test
      - run: npx squint publish squint-report --project web --release ${{ github.ref_name }}
```

`--server` (or `SQUINT_SERVER`) points the CLI at another server; the default is `https://squint.futo.org/api`.

## Trash

A build is kept while it is the newest complete main build of its project, the newest complete build of an open pull request, or a release (a build that is still publishing is kept too). Publishing the same release name again replaces the older copy. Every other build moves to the trash when a newer build completes or its pull request is merged or closed, and comes back if the pull request is reopened.

A build that has been in the trash for 30 days is deleted. Its screenshots are deleted from storage with it, except the ones a kept build still shows, including the baseline it is compared against. The server checks the trash every hour.

## Releases

The version lives in `server/src/constants.ts`. To cut a release, set it and generate the release notes from the `feat`, `fix` and `perf` commits since the last version, then commit the result as `chore: version <version>`:

```
mise run version 0.2.0
```

The What's new dialog shows those notes. The About dialog shows the version, and the commit and date the image was built from (`BUILD_SOURCE_COMMIT` and `BUILD_DATE` build arguments).

## Tests

```
pnpm --filter squint-server run test          # unit and controller tests
pnpm --filter squint-server run test:medium   # services and repositories on a real Postgres (needs docker)
```

## Docker

The image builds the web app and the API, and the API serves both:

```
docker build --build-arg BUILD_SOURCE_COMMIT=$(git rev-parse HEAD) --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) -t squint .
docker compose up
```

## GitHub App

The API is the webhook receiver of a GitHub App. Installing the app on an organization lets the API show each pull request's title and state, and mark it merged or closed without waiting for CI.

Create the app under the organization's developer settings with:

- Webhook URL: `https://squint.futo.org/api/github/webhook`
- Webhook secret: the value of `SQUINT_GITHUB_WEBHOOK_SECRET`
- Repository permissions: Pull requests, read-only
- Subscribe to events: Pull request

Then install it on the organizations that publish screenshots. Deliveries are verified with the `X-Hub-Signature-256` header; anything unsigned is rejected.

## License

Squint is licensed under the [Source First License 1.1](LICENSE).
