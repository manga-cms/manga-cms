# Roadmap

Last updated: 2026-06-12

Manga CMS is a public self-hosted manga publishing engine. The public repository
contains the open content format, validation contracts, API, Viewer, CMS,
runtime-state primitives, ingestion tooling, and public reader functionality.

This roadmap is public-facing. It intentionally separates OSS work from future
private commercial platform work. See [`docs/oss-boundary.md`](docs/oss-boundary.md)
and [`docs/architecture/layer-boundary.md`](docs/architecture/layer-boundary.md) for
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

### 1. Public OSS / Self-Hosted Foundation

Goal: Provide a stable, reliable foundation for self-hosted manga publishing.

Current focus:
- Keep GitHub Actions CI green and diagnosable.
- Keep `contents/` and `packs/` as the canonical source of truth.
- Stabilize schema validation, content loading, and Pack validation contracts.
- Document and drill backup/restore, monitoring, and rollback procedures for self-hosting.
- Keep Search Console, sitemap, robots, lightweight analytics, and public
  Reader smoke checks as operational launch gates rather than commercial
  platform features.

### 2. Creator CMS Operations

Goal: Make self-hosted editing and review workflows practical for creators and editors.

Current focus:
- Polish Page Structure Review as the top priority.
- Support Panel / Bubble bbox overlays on page images.
- Enable side-by-side review of source text, OCR text, and chosen text.
- Allow editors to accept or reject ingestion candidates.
- Save confirmed results to the canonical draft.
- Improve text export, translation draft import, feedback triage, and proposal workflows.

### 3. Ingestion Workflow

Goal: Reduce human effort to structure manuscripts, without requiring full automation.

Current focus:
- Treat CSP (Clip Studio Paint), PSD, and text exports as priority inputs.
- Treat OCR as auxiliary information, not the ground truth.
- Keep LLM/VLM extraction as an optional enhancement, never a mandatory standard.
- Maintain the flow: automated extraction -> confidence scoring -> human review
  -> confirm -> save to canonical `contents/` and `packs/` -> runtime DB
  reindex.

### 4. Public Reader Enhancement

Goal: Improve the public Reader while preserving the normal manga reading
experience.

Current focus:
- Keep image-first reading stable on mobile and desktop.
- Keep Share URL, OGP, robots/sitemap, and localized metadata smoke checks
  green.
- Explore an opt-in HTML text layer for Bubble text so selected titles can
  support browser text selection, search, accessibility, and browser
  translation experiments.
- Keep the HTML text layer feature-flagged and off by default until content
  policy, text exposure risk, layout QA, and browser translation behavior are
  confirmed.
- Keep `Bubble.textOriginal` as canonical source text; layout hints such as
  `textLayout.lines` remain optional visual metadata and must not change search,
  read-aloud, export, or share-description source-of-truth behavior.

See [`docs/reader-text-layer-spec.md`](docs/reader-text-layer-spec.md) for the
planned staged implementation.

### 5. Provider-Neutral Primitives

Goal: Keep the public repository safe for general open-source use.

Current focus:
- Define roles, rights, entitlements, manifests, and exports as generic, OSS-safe abstractions.
- Ensure the self-hosted engine does not require specific commercial vendors to run.
- Keep payment provider integrations, tenant SaaS automation, and custom domain routing separated into the private commercial layer.

### 6. Future Private Commercial Platform

Goal: Hosted/commercial operations for Manga CMS. This is not part of the OSS deliverable.

Future private commercial work includes:
- Hosted creator registration and tenant operations.
- Paid checkout, purchase recovery, and reconciliation.
- Payout operations and revenue sharing.
- Custom domains and hosted tenant routing.
- Commercial CDN and object-storage adapters tied to specific business deployments.

These details will remain outside the public repository. The public repo may contain generic interfaces that allow them, but no specific business implementations.

## Near-Term Public Priorities

1. Keep CI green after every public change.
2. Stabilize schema, validation, and content loading contracts.
3. Polish CMS Page Structure Review (bbox overlay, accept/reject candidates, save to canonical draft).
4. Refine Ingestion workflow prioritizing PSD/text-export over OCR/LLM.
5. Drill backup/restore for both Postgres state and canonical `contents/`/`packs/`.
6. Refine text export and translation draft import workflows.
7. Design and prototype a feature-flagged HTML text layer for selected Reader
   content only after the public launch smoke remains green.
8. Keep Search Console, robots/sitemap, public Reader, Share URL, and OGP smoke
   checks green for self-hosted public launch.
9. Keep generic manifest/export and entitlement designs provider-neutral.

## References

- [`docs/oss-boundary.md`](docs/oss-boundary.md)
- [`docs/architecture/layer-boundary.md`](docs/architecture/layer-boundary.md)
- [`docs/production-ops-checklist.md`](docs/production-ops-checklist.md)
- [`docs/api-contract.md`](docs/api-contract.md)
- [`docs/reader-text-layer-spec.md`](docs/reader-text-layer-spec.md)
- [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md)
- [`docs/BACKUP-RESTORE.md`](docs/BACKUP-RESTORE.md)
