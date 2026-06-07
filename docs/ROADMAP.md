# Roadmap

Last updated: 2026-06-07

Manga CMS is a public self-hosted manga publishing engine. The public repository
contains the open content format, validation contracts, API, Viewer, CMS,
runtime-state primitives, ingestion tooling, and public reader functionality.

This roadmap is public-facing. It intentionally separates OSS work from future
private commercial platform work. See [`docs/oss-boundary.md`](oss-boundary.md)
and [`docs/architecture/layer-boundary.md`](architecture/layer-boundary.md) for
the architecture boundary.

## Current Public State

The public repository currently includes:

- Open content contracts for `Series -> Episode -> Page -> Panel -> Bubble`.
- Canonical editorial content and Pack storage under `contents/` and `packs/`.
- Runtime validation through `packages/schemas` and shared domain types in
  `packages/domain`.
- A Hono API app, Astro Viewer, React CMS, Prisma runtime-state package, and
  ingestion proof-of-concept package.
- Public Reader routes, Share URL facades, Page/Panel OGP image generation,
  localized metadata handling, robots/sitemap routes, and English `noindex`
  gating.
- Creator CMS flows for content editing, page structure review, text export,
  translation draft import, feedback triage, and proposal workflows.
- Split GitHub Actions CI that runs dependency install, Prisma client
  generation, package builds, app builds, CMS tests, ingestion tests, and
  content validation.

## Roadmap Areas

### 1. Public OSS / Open Format

Goal: keep the content format and validation layer useful outside the hosted
Manga CMS site.

Current focus:

- Maintain the `Series -> Episode -> Page -> Panel -> Bubble` contract.
- Keep `contents/` and `packs/` as the canonical editorial source of truth.
- Improve schema validation, content loading, Pack validation, and export tools.
- Continue documenting metadata, text layout, translation, feedback, and share
  policies as generic OSS-safe contracts.
- Develop generic manifest/export concepts without binding them to one
  production vendor.

Not in scope for this layer:

- Hosted creator accounts.
- Paid checkout and payout operations.
- Proprietary anti-leak or forensic protection systems.
- Vendor-specific production adapters as the only implementation path.

### 2. Public Manga Site Launch

Goal: run a reliable public manga site using the OSS engine.

Current focus:

- Keep GitHub Actions CI green and diagnosable.
- Verify Search Console ownership and sitemap submission for public hosts.
- Confirm lightweight analytics on production public hosts without adding a
  consent burden prematurely.
- Keep English pages user-visible but `noindex` until translation quality,
  metadata, and support operations are ready.
- Keep Share URLs, OGP metadata, and Reader navigation safe for public readers.
- Make public content restore and re-seeding repeatable.

Launch readiness depends on operations, not on adding commercial features.

### 3. Creator CMS Operations

Goal: make self-hosted editing and review workflows practical for creators and
editors.

Current focus:

- Polish Page Structure Review for Panel/Bubble geometry and source text.
- Improve text export, translation draft import, feedback triage, and proposal
  workflows.
- Keep canonical source text separate from translation and layout metadata.
- Improve import/review ergonomics while preserving the canonical content
  contract.

Future OSS-safe improvements:

- Better review status summaries.
- Safer diff and rollback tools for content edits.
- More deterministic import/export reports.
- More complete documentation for self-hosted editorial operations.

### 4. Infrastructure / Production Ops

Goal: make self-hosted production operation repeatable and recoverable.

Current focus:

- Document backup/restore for canonical content separately from runtime DB
  state.
- Drill Postgres backup/restore for runtime state.
- Drill content volume backup/restore for `contents/` and `packs/`.
- Add monitoring and alerting for API health, image delivery, OGP generation,
  feedback/proposal errors, and deploy failures.
- Keep production deploy and rollback procedures simple enough for a clean
  checkout.
- Keep generic manifest/export design OSS-safe.

Important boundary:

- `contents/` and `packs/` remain canonical manga content sources.
- Postgres/runtime DB state is not the canonical manga content store.
- Vendor-specific published asset adapters can exist later, but the public
  contract should remain provider-neutral.

### 5. Future Private Commercial Platform

Goal: future hosted/commercial Manga CMS operations. This is not part of the OSS
deliverable.

Examples of private/commercial work:

- Hosted creator registration and account operations.
- Paid checkout, webhook fulfillment, purchase recovery, and reconciliation.
- Revenue sharing, payout operations, and commercial support workflows.
- Custom domains and hosted tenant routing.
- Production object-storage/CDN adapters tied to a commercial deployment.

The public repository may contain generic interfaces or documentation that make
self-hosting possible, but it should not include private business operations or
revenue-specific implementation.

### 6. Future Private R&D / IP Protection

Goal: protect commercial content and handle abuse in private deployments without
turning the OSS roadmap into an anti-leak design document.

This work should remain private unless it is reduced to a generic, safe
operational checklist. Do not publish detailed fingerprinting, watermarking,
leak detection, or forensic algorithms in the public roadmap.

## Near-Term Public Priorities

1. Keep CI green after every public change.
2. Complete production Search Console and sitemap smoke checks.
3. Confirm production analytics events for public hosts only.
4. Create repeatable content restore/seed/publish operations for public sample
   content.
5. Run Postgres runtime-state backup/restore drills.
6. Run `contents/` and `packs/` backup/restore drills.
7. Add production monitoring and rollback documentation.
8. Continue CMS structure-review and text/translation workflow polish.
9. Keep generic manifest/export design provider-neutral.

## References

- [`docs/oss-boundary.md`](oss-boundary.md)
- [`docs/architecture/layer-boundary.md`](architecture/layer-boundary.md)
- [`docs/production-ops-checklist.md`](production-ops-checklist.md)
- [`docs/api-contract.md`](api-contract.md)
- [`docs/CONTENT_GUIDE.md`](CONTENT_GUIDE.md)
- [`docs/BACKUP-RESTORE.md`](BACKUP-RESTORE.md)
