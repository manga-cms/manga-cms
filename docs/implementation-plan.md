# Implementation Plan

This document fixes the implementation boundary for parallel work on the
current manga-cms monorepo. It is a planning and coordination document only.
Feature implementation should happen in follow-up branches after this contract
is merged.

## Scope

Build on the existing repository shape:

```text
apps/
  api/       Hono API server
  cms/       React + Vite creator CMS
  viewer/    Astro public reader

packages/
  domain/    canonical TypeScript domain types and repository interfaces
  schemas/   Zod schemas for content and pack validation
  db/        Prisma-backed runtime state repositories
  ingestion/ ingestion proof of concept

contents/    source-of-truth manga content files
packs/       translation, commentary, learning, and accessibility packs
```

Do not introduce a parallel `packages/shared` package for the same concepts.
`packages/domain` and `packages/schemas` are the shared contract packages.

## Canonical Terms

Use the existing content hierarchy everywhere:

```text
Series
  Episode
    Page
      Panel
        Bubble
```

Avoid introducing `Manga`, `Chapter`, or generic `Page` models that conflict
with the established domain. If UI labels need friendlier wording, keep the API,
types, docs, and storage contract in Series / Episode / Page / Panel / Bubble
terms.

## Sources Of Truth

The source of truth order is:

1. `openapi.yaml` for HTTP API behavior.
2. `packages/domain/src/types.ts` for canonical TypeScript domain types.
3. `packages/schemas/src/content.ts` for runtime validation of `contents/`.
4. `packages/domain/src/content-loader.ts` and `content-writer.ts` for current
   repository interfaces.
5. `packages/db/prisma/schema.prisma` for runtime state such as entitlements,
   ingestion jobs, auth, purchase records, and redeem codes.

`contents/` is currently the canonical content store for Series / Episode /
Page / Panel / Bubble data. The database is not the primary content store yet.
Moving canonical content to DB-backed storage is a separate migration project.

## Contract Phase Deliverables

This phase creates and maintains only coordination artifacts:

- `docs/implementation-plan.md`
- `docs/api-contract.md`
- `AGENTS.md`

No feature code, migrations, UI work, or endpoint changes belong in the
contract phase unless a later task explicitly asks for them.

## Recommended Worktree Split

Create worktrees only after this contract is merged into the shared base branch.

### Thread A: API / CMS Core

Branch: `codex/cms-core`

Allowed edit scope:

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
- narrowly scoped docs that explain API or data behavior

Restricted scope:

- Do not redesign `apps/cms` UI.
- Do not redesign `apps/viewer` UI.
- Do not make broad styling changes.

Primary tasks:

- Keep API handlers aligned with `openapi.yaml`.
- Expand write-side CMS endpoints when needed.
- Maintain `ContentRepository` and `ContentWriteRepository` contracts.
- Add or update Zod schemas when content shape changes.
- Add seed/sample content only when needed for API and integration tests.
- Keep entitlement, delivery, auth, purchase, and ingestion state coherent.

### Thread B: Creator CMS UI

Branch: `codex/cms-admin-ui`

Allowed edit scope:

- `apps/cms/`
- CMS-specific docs and screenshots if requested

Read-only contract scope:

- `openapi.yaml`
- `docs/api-contract.md`
- `packages/domain/`
- `packages/schemas/`

Restricted scope:

- Do not change API behavior in `apps/api/`.
- Do not edit Prisma schema or DB repositories.
- Do not make breaking changes to shared domain or schema packages.
- Do not change public reader behavior in `apps/viewer/`.

Primary tasks:

- Improve Series list/detail workflows.
- Improve Episode create/edit workflows.
- Add or improve Page upload/review UI.
- Add Page / Panel / Bubble ordering and structure review UI.
- Add CMS preview and publish controls.
- Use a mock adapter only for API gaps, and document those gaps.

### Thread C: Public Viewer / Reader

Branch: `codex/viewer-reader`

Allowed edit scope:

- `apps/viewer/`
- viewer-specific docs and screenshots if requested

Read-only contract scope:

- `openapi.yaml`
- `docs/api-contract.md`
- `packages/domain/`
- `packages/schemas/`

Restricted scope:

- Do not change API behavior in `apps/api/`.
- Do not edit Prisma schema or DB repositories.
- Do not make breaking changes to shared domain or schema packages.
- Do not change creator CMS behavior in `apps/cms/`.

Primary tasks:

- Improve public Series and Episode browsing.
- Improve manga reader navigation.
- Keep normal reading mode clean and fast.
- Add study/inspection affordances only where they do not pollute normal mode.
- Add or refine mobile, keyboard, SEO, and OGP behavior.
- Ensure gated or unpublished content does not leak into public reader flows.

### Thread D: Integration

Branch: `codex/integration-cms-reader`

Create this only after Threads A, B, and C have reviewable branches.

Allowed edit scope:

- Any files needed for integration fixes, but changes must be minimal.

Rules:

- Do not change product behavior casually during integration.
- If the API contract and UI assumptions disagree, report the disagreement and
  make the smallest fix that preserves the contract.
- Prefer updating generated or duplicated client-side types to match
  `packages/domain` and `openapi.yaml`, not the other way around.

Integration checks:

- API response shapes match `docs/api-contract.md`.
- CMS can read and write sample content.
- Viewer can read content through API-first SSR paths.
- Image delivery paths render through the expected tokenized or admin image
  endpoints.
- Entitlement-gated episodes do not expose protected image URLs publicly.
- `contents/` files still pass Zod validation.

## Shared File Rules

These files are high-conflict and should be owned by Thread A until integration:

- `openapi.yaml`
- `docs/api-contract.md`
- `packages/domain/src/types.ts`
- `packages/domain/src/content-loader.ts`
- `packages/domain/src/content-writer.ts`
- `packages/schemas/src/content.ts`
- `packages/db/prisma/schema.prisma`

Threads B and C may read these files but should not edit them during parallel
work. If UI work needs a contract change, record the requested change in the
thread summary and leave the contract edit to Thread A or Integration.

## Implementation Order

1. Merge this contract phase.
2. Create the API / CMS Core branch and implement contract-backed server work.
3. In parallel, create CMS UI and Viewer worktrees that consume the stable
   contract.
4. Keep each thread scoped to its allowed directories.
5. Merge API / CMS Core first if it changes shared types or OpenAPI.
6. Merge UI branches after rebasing on the latest contract.
7. Run the Integration branch to resolve type, build, and behavior mismatches.

## Test Strategy

Minimum verification before handing off a branch:

- `pnpm build`
- `pnpm lint`
- Package tests that exist for the touched package, for example
  `pnpm --filter @manga/ingestion test`

Add tests in the package that owns the behavior:

- API behavior: API-level route or repository tests.
- Content validation: schema and repository tests in `packages/schemas` or
  `packages/domain`.
- DB behavior: repository tests in `packages/db`.
- CMS behavior: component or client adapter tests once a test runner is added.
- Viewer behavior: build checks and browser verification for reader flows.

The repository does not currently expose a root `pnpm test` script. Do not claim
repo-wide test coverage until that script exists.

## Out Of Scope For This Phase

- Replacing `contents/` with DB-backed canonical content.
- Splitting the repository into multiple GitHub repositories.
- Creating a new `packages/shared` package.
- Renaming Series / Episode to Manga / Chapter in code.
- Reworking all API routes in `apps/api/src/index.ts`.
- Adding authentication providers, commerce webhooks, CDN, or monitoring.
