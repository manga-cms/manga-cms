# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

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

COPY . .

RUN DATABASE_URL="postgresql://manga:manga@postgres:5432/manga_cms?schema=public" pnpm --filter @manga/db db:generate:postgres
RUN pnpm --filter @manga/api... build

FROM base AS runner

ENV NODE_ENV="development"
ENV PORT="3000"
ENV PRISMA_PROVIDER="postgresql"

COPY --from=build /app /app
COPY apps/api/docker-entrypoint.sh /usr/local/bin/manga-api-entrypoint

RUN chmod +x /usr/local/bin/manga-api-entrypoint

EXPOSE 3000

ENTRYPOINT ["manga-api-entrypoint"]
CMD ["pnpm", "--filter", "@manga/api", "start"]
