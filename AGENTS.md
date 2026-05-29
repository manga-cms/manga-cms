# AGENTS.md

This repository is a monorepo for a structured manga CMS. Follow the existing
architecture before adding new patterns.

## Canonical Architecture

Use the established domain vocabulary:

```text
Series -> Episode -> Page -> Panel -> Bubble
```

Do not rename these concepts to Manga / Chapter in code, API contracts, schema
files, or docs unless a task explicitly asks for a migration.

Primary contract files:

- `openapi.yaml`
- `docs/api-contract.md`
- `packages/domain/src/types.ts`
- `packages/schemas/src/content.ts`
- `packages/domain/src/content-loader.ts`
- `packages/domain/src/content-writer.ts`
- `packages/db/prisma/schema.prisma`

`contents/` is currently the canonical content store for manga content.
`packages/db` is for runtime state such as entitlements, ingestion jobs, auth,
purchase records, and redeem codes. Do not move canonical content into the DB
without an explicit migration task.

## Repository Layout

```text
apps/api      Hono API server
apps/cms      React + Vite creator CMS
apps/viewer   Astro public reader

packages/domain    domain types and repository interfaces
packages/schemas   Zod schemas for content and pack validation
packages/db        Prisma-backed runtime state repositories
packages/ingestion ingestion proof of concept

contents      Series / Episode / Page / Panel / Bubble source data
packs         extension packs
docs          product, operations, and contract docs
scripts       local verification scripts
```

## Commands

Install dependencies:

```bash
pnpm install
```

Generate Prisma client:

```bash
pnpm --filter @manga/db db:generate
```

Build all packages and apps:

```bash
pnpm build
```

Run the repo lint command:

```bash
pnpm lint
```

Run package tests that exist:

```bash
pnpm --filter @manga/ingestion test
```

There is no root `pnpm test` script at the time this file was written. Do not
claim repo-wide tests passed unless a root test script has been added and run.

Run local services:

```bash
cd apps/api && pnpm dev
cd apps/viewer && API_BASE=http://localhost:3000/api/v1 pnpm dev
cd apps/cms && pnpm dev
```

Default local URLs:

- API: `http://localhost:3000/api/v1/health`
- Viewer: `http://localhost:4321`
- CMS: `http://localhost:5173`

If the API is not on port 3000, start CMS with:

```bash
API_PROXY_TARGET=http://localhost:3100 pnpm dev
```

## Parallel Work Boundaries

Do not run multiple active threads against the same shared contract files.

### API / CMS Core Thread

Allowed:

- `apps/api/`
- `packages/domain/`
- `packages/schemas/`
- `packages/db/`
- `packages/ingestion/`
- `contents/`
- `packs/`
- `scripts/`
- `openapi.yaml`
- `docs/api-contract.md`
- narrowly scoped API/data docs

Avoid:

- broad `apps/cms` UI redesigns
- broad `apps/viewer` UI redesigns
- unrelated style changes

### Creator CMS UI Thread

Allowed:

- `apps/cms/`
- CMS-specific docs if needed

Read-only:

- `openapi.yaml`
- `docs/api-contract.md`
- `packages/domain/`
- `packages/schemas/`

Avoid:

- API route changes
- Prisma schema changes
- breaking shared type/schema changes
- public viewer changes

### Public Viewer / Reader Thread

Allowed:

- `apps/viewer/`
- viewer-specific docs if needed

Read-only:

- `openapi.yaml`
- `docs/api-contract.md`
- `packages/domain/`
- `packages/schemas/`

Avoid:

- API route changes
- Prisma schema changes
- breaking shared type/schema changes
- creator CMS changes

### Integration Thread

Allowed:

- Minimal cross-cutting fixes needed to merge API, CMS, and Viewer branches.

Rules:

- Preserve the API contract unless the task explicitly approves a change.
- Resolve duplicated UI types toward `packages/domain` and `openapi.yaml`.
- Report contract mismatches instead of silently changing product behavior.

## Editing Rules

- Keep changes scoped to the requested task.
- Prefer existing package boundaries over new abstractions.
- Use `packages/domain` and `packages/schemas` for shared contracts; do not add
  a new `packages/shared` package for the same purpose.
- Update `openapi.yaml` and `docs/api-contract.md` together when API behavior
  changes.
- Update Zod schemas with domain type changes that affect `contents/`.
- Preserve existing user changes in the working tree.
- Do not run destructive git commands unless explicitly requested.

## Verification Expectations

Before handing off implementation work, run the narrowest useful verification:

- For shared or cross-app changes: `pnpm build`
- For repo lint confidence: `pnpm lint`
- For ingestion package changes: `pnpm --filter @manga/ingestion test`
- For DB schema changes: `pnpm --filter @manga/db db:generate`
- For frontend behavior changes: run the relevant dev server and verify in the
  browser when practical.

If a command fails because the repository lacks a script or because the failure
is unrelated to the task, report that clearly in the final response.
