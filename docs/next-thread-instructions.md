# Next Thread Instructions

Use these prompts after `main` includes PRs #1 through #5:

- Integrated CMS core, admin UI, and reader work
- Stable `Series.shareImageUrl`
- Persisted ingestion review endpoints
- Reviewed-draft decision preservation
- Admin Page image upload

Keep one thread per workstream. Do not run multiple active threads against the
same shared contract files unless the task explicitly requires integration.

## Before Starting New Threads

Run from the main workspace:

```bash
git switch main
git pull --ff-only
pnpm install
pnpm build
```

Recommended worktrees:

```bash
git worktree add ../manga-cms-publish-schedule -b codex/publish-schedule main
git worktree add ../manga-cms-bulk-import -b codex/bulk-import main
git worktree add ../manga-cms-feedback-triage -b codex/feedback-triage main
git worktree add ../manga-cms-reader-qa -b codex/reader-qa main
```

If a branch name is already checked out, choose a new `codex/...` branch name
instead of reusing the old one.

## Thread A: Publish Scheduling Contract

Purpose: define publication timing and visibility before broad UI work.

Allowed:

- `openapi.yaml`
- `docs/api-contract.md`
- `docs/NEXT_ACTIONS.md`
- `packages/domain/src/types.ts`
- `packages/schemas/src/content.ts`
- `packages/domain/src/content-loader.ts`
- `packages/domain/src/content-writer.ts`
- `apps/api/`

Avoid:

- broad CMS layout changes
- viewer redesign
- moving canonical content into DB

Prompt:

```text
Use $manga-cms-agent.

Implement the publish scheduling contract for manga-cms.

Goal:
- Add explicit scheduling fields for Series/Episode visibility without changing
  the canonical hierarchy: Series -> Episode -> Page -> Panel -> Bubble.
- Support publish start, publish end, archived/hidden behavior, and future bulk
  status changes.

Constraints:
- Treat openapi.yaml, docs/api-contract.md, packages/domain, and
  packages/schemas as contract sources.
- Do not move canonical content from contents/ into the DB.
- Keep changes minimal and backwards compatible for existing content.

Expected output:
- Domain/schema fields for scheduling.
- API behavior documented in openapi.yaml and docs/api-contract.md.
- Clear rules for whether Public Reader endpoints should hide, gate, or expose
  scheduled/expired content.
- Minimal API implementation if the contract is straightforward.

Verification:
- pnpm --filter @manga/domain build
- pnpm --filter @manga/schemas build
- pnpm --filter @manga/api build
- pnpm build
- pnpm lint

Do not implement broad CMS UI in this thread.
```

## Thread B: Bulk Import / Asset Intake

Purpose: make prepared episode assets easier to ingest.

Allowed:

- `apps/api/`
- `packages/domain/`
- `packages/schemas/`
- `packages/ingestion/`
- `scripts/`
- `openapi.yaml`
- `docs/api-contract.md`
- `docs/storyboard-data-import.md`
- narrowly scoped `apps/cms/` intake UI if needed

Avoid:

- unrelated Reader changes
- committing local-only verification content
- committing `contents/storyboard-ui-check/`

Prompt:

```text
Use $manga-cms-agent.

Design and implement the next bulk import step for manga-cms.

Goal:
- Add a safe import path for prepared episode assets and draft metadata.
- Support importing a prepared local directory or archive conceptually, but keep
  the first implementation small if archive upload is too large.
- Convert imported assets into ingestion draft jobs, not directly into canonical
  contents unless explicitly confirmed by review.

Constraints:
- contents/storyboard-ui-check/ and other local verification assets must not be
  committed.
- Preserve the ingestion review workflow:
  candidates -> review decisions -> write-reviewed-draft -> confirm.
- Use existing Page image upload behavior where useful.

Expected output:
- API contract for bulk import or prepared-directory import.
- Domain/ingestion helpers for draft creation.
- Minimal CMS or script flow to exercise the import.
- Documentation of limits and remaining gaps.

Verification:
- pnpm --filter @manga/ingestion test
- pnpm --filter @manga/api build
- pnpm --filter @manga/cms build if CMS is touched
- pnpm build
- pnpm lint
```

## Thread C: CMS Feedback Triage

Purpose: close the loop from Reader feedback into CMS review work.

Allowed:

- `apps/api/`
- `apps/cms/`
- `packages/domain/`
- `packages/schemas/`
- `openapi.yaml`
- `docs/api-contract.md`
- `docs/feedback-mvp-spec.md`

Avoid:

- Reader interaction redesign
- proposal/pack implementation beyond minimal conversion notes

Prompt:

```text
Use $manga-cms-agent.

Implement CMS Feedback Triage for records saved by POST /api/v1/feedback.

Goal:
- Add admin endpoints to list feedback, inspect one record, update status, and
  optionally close/triage records.
- Add a minimal CMS list/detail screen for feedback records.
- Preserve the current JSONL feedback storage unless a migration is explicitly
  necessary.

Constraints:
- Keep proposal conversion as a documented future action unless the needed
  proposal contract already exists.
- Do not redesign the Reader feedback modal in this thread.

Expected output:
- OpenAPI and docs/api-contract updates.
- API implementation using existing feedback repository patterns.
- CMS route and screens for list/detail/status update.

Verification:
- pnpm --filter @manga/api build
- pnpm --filter @manga/cms build
- pnpm build
- pnpm lint
- Browser-check the CMS triage screen when practical.
```

## Thread D: Reader QA And Publication Gating

Purpose: keep Reader behavior stable while backend contracts evolve.

Allowed:

- `apps/viewer/`
- viewer-specific docs

Read-only unless explicitly approved:

- `openapi.yaml`
- `docs/api-contract.md`
- `packages/domain/`
- `packages/schemas/`

Prompt:

```text
Use $manga-cms-agent.

QA and tighten the Public Viewer / Reader against the current API contract.

Focus:
- API-backed episode pages still use delivery URLs and do not leak raw origin
  image paths.
- shareImageUrl is preferred for SEO/OGP when present.
- Reader handles missing images, gated content, and future scheduled/expired
  content responses gracefully.
- Mobile/tablet/desktop reader controls still work after recent API/CMS changes.

Constraints:
- Do not change shared API contracts from the viewer branch.
- If a contract gap is found, report it for API/Core or Integration.

Verification:
- pnpm --filter @manga/viewer build
- API-backed browser check with API_BASE=http://localhost:3000/api/v1
- Screenshot desktop/tablet/mobile if UI behavior changes.
```

## Integration Thread

Use after any two or more workstream PRs are ready.

Prompt:

```text
Use $manga-cms-agent.

Integrate the ready manga-cms branches into a single integration branch.

Check:
- API contract mismatches
- type errors
- migration or contents/ assumptions
- CMS can upload an image, save episode metadata, review ingestion candidates,
  and publish/reload without touching ignored local verification content
- Public Reader does not expose draft/scheduled/expired content unless the API
  contract explicitly says it should

Rules:
- Preserve the API contract unless a change is explicitly approved.
- Resolve duplicated UI types toward packages/domain and openapi.yaml.
- If product behavior conflicts, report the mismatch and apply the smallest
  agreed fix.

Verification:
- pnpm --filter @manga/db db:generate
- pnpm build
- pnpm lint
- OpenAPI YAML parse and component ref check
```

