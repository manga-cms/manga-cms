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

Recently completed public work:

- Content validation now runs `lintPageContent` and validates Pack target
  references when public sample content exists. Empty public checkouts still
  pass validation.
- Prepared-directory ingestion reads real image dimensions instead of silently
  using fixed placeholder dimensions.
- Page Structure Review supports page-level Bubbles with `panelId: null`,
  Bubble reassignment between Panels and page-level state, direct page-level
  Bubble ordering, and non-blocking warnings for pending review items.
- Delivery lookup uses indexed Page references instead of linear scans.
- CMS ingestion comparison badges are intentionally limited to future runtime
  ingestion overlays; OCR/source/confidence data must not be stored in
  canonical Bubble data or public metadata.
- Public sample content preparation is documented in
  [`docs/SAMPLE-CONTENT-CHECKLIST.md`](docs/SAMPLE-CONTENT-CHECKLIST.md).

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
- Enable side-by-side review of source text, OCR text, and chosen text from
  ingestion runtime overlays, not canonical public metadata.
- Allow editors to accept or reject ingestion candidates.
- Keep warning states visible without turning review warnings into save
  blockers.
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
- Keep detection confidence, OCR text, and candidate comparison data in
  ingestion job artifacts or CMS review overlays until a human confirms the
  canonical draft.

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
2. Keep schema, validation, Pack target validation, and content loading
   contracts stable.
3. Finish the next Page Structure Review polish pass:
   - connect ingestion review-candidate overlays to the existing comparison UI;
   - keep candidate metadata out of canonical Bubble/public metadata;
   - refine warning density so editors see actionable items first;
   - preserve `panelId: null` and page-level Bubble workflows.
4. Refine Ingestion workflow prioritizing PSD/text-export over OCR/LLM:
   - run local private sample drills without committing private assets;
   - document parser limitations from those drills without publishing private
     text or image details;
   - keep OCR/LLM as optional candidate generators only.
5. Prepare the first public sample content package:
   - finalize sample-specific rights text with the creator;
   - verify GitHub inclusion, translation permission, OGP/screenshot use, and
     commercial-sale prohibition;
   - add only public-safe, licensed sample assets when ready.
6. Drill backup/restore for both Postgres runtime state and canonical
   `contents/`/`packs/`, keeping their source-of-truth roles separate.
7. Refine text export, translation draft import, feedback triage, and proposal
   workflows after sample content exists.
8. Design and prototype a feature-flagged HTML text layer for selected Reader
   content only after public launch smoke and rights checks remain green.
9. Keep Search Console, robots/sitemap, public Reader, Share URL, and OGP smoke
   checks green for self-hosted public launch.
10. Keep generic manifest/export and entitlement designs provider-neutral.

## Review Checkpoints

Use external review when one of these boundaries changes:

- canonical content shape, schema validation, or Pack target validation;
- Page Structure Review candidate handling or ingestion overlay contracts;
- sample content rights text before committing content to Git;
- public Reader sharing, OGP, sitemap, robots, or indexing behavior;
- backup/restore procedure before relying on it for a live self-hosted install.

Routine UI polish, wording fixes, and docs-only cleanup do not need external
review unless they touch one of the boundaries above.

## References

- [`docs/oss-boundary.md`](docs/oss-boundary.md)
- [`docs/architecture/layer-boundary.md`](docs/architecture/layer-boundary.md)
- [`docs/production-ops-checklist.md`](docs/production-ops-checklist.md)
- [`docs/api-contract.md`](docs/api-contract.md)
- [`docs/reader-text-layer-spec.md`](docs/reader-text-layer-spec.md)
- [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md)
- [`docs/BACKUP-RESTORE.md`](docs/BACKUP-RESTORE.md)
