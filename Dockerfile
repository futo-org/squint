FROM node:26-bookworm-slim AS builder

ENV CI=1 \
  PNPM_HOME=/pnpm \
  PATH="/pnpm:$PATH"

RUN npm install --global pnpm@12.20.0 && pnpm config set store-dir /pnpm/store

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json ./

FROM builder AS sdk

COPY packages/sdk/package.json ./packages/sdk/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter @futo-org/squint-sdk install --frozen-lockfile

COPY open-api ./open-api/
COPY packages/sdk ./packages/sdk/
RUN pnpm --filter @futo-org/squint-sdk build

FROM builder AS server

COPY server/package.json ./server/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter squint-server install --frozen-lockfile

COPY server ./server/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm --filter squint-server exec nest build && \
  pnpm --filter squint-server --prod --legacy deploy /output/server

FROM sdk AS web

COPY web/package.json ./web/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter squint-web... install --frozen-lockfile

COPY web ./web/
RUN pnpm --filter squint-web build

FROM node:26-bookworm-slim

ARG BUILD_SOURCE_COMMIT=""
ARG BUILD_DATE=""

ENV NODE_ENV=production \
  SQUINT_BUILD_COMMIT=${BUILD_SOURCE_COMMIT} \
  SQUINT_BUILD_DATE=${BUILD_DATE} \
  SQUINT_HOST=0.0.0.0 \
  SQUINT_PORT=3000 \
  SQUINT_WEB_ROOT=/usr/src/app/www

WORKDIR /usr/src/app

COPY --from=server /output/server ./server
COPY --from=web /usr/src/app/web/build ./www

EXPOSE 3000
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.SQUINT_PORT + '/api/server/ping').then((response) => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "server/dist/main.js"]
