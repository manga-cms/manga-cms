# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app
RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/cms/package.json apps/cms/package.json
COPY apps/viewer/package.json apps/viewer/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/ingestion/package.json packages/ingestion/package.json
COPY packages/schemas/package.json packages/schemas/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY apps/cms apps/cms

RUN pnpm --filter @manga/cms build

FROM nginx:1.27-alpine AS runner

COPY apps/cms/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/cms/dist /usr/share/nginx/html

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
