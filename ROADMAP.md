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
- Public release tagging and changelog expectations are documented in
  [`docs/RELEASE.md`](docs/RELEASE.md).

## Roadmap Areas

### 1. Public OSS / Self-Hosted Foundation

Goal: Provide a stable, reliable foundation for self-hosted manga publishing.

Current focus:
- Keep GitHub Actions CI green and diagnosable.
- Keep `contents/` and `packs/` as the canonical source of truth.
- Stabilize schema validation, content loading, and Pack validation contracts.
- Document and drill backup/restore, monitoring, and rollback procedures for self-hosting.
- Move production runtime state that is still file-backed into `packages/db`
  before multi-instance or multi-editor operation depends on it.
- Keep Search Console, sitemap, robots, lightweight analytics, and public
  Reader smoke checks as operational launch gates rather than commercial
  platform features.
- Define a simple public release discipline: version tags, a concise changelog,
  and a policy for when schemaVersion changes are required.

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
- Add Reader preview where editors need to judge reading flow, translation fit,
  Pack behavior, spoiler behavior, and public Reader presentation.
- Introduce edit conflict control, such as ETag / If-Match or explicit
  revision checks, before multiple editors or autosave sessions can overwrite
  each other.
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
- Move dynamically generated OGP images toward generic immutable published
  artifacts through the provider-neutral manifest/export model before public
  sharing volume makes crawler cache behavior difficult to reason about.
- Keep static publish/export as the preferred long-term shape for public free
  Episodes, so Reader HTML, published JSON/images, OGP images, and manifests
  can be emitted together.
- Prefer attribution-bearing official share cards over copy-prevention claims:
  public sharing should carry creator credit and a canonical source URL.
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

### 6. Adoption And Community Readiness

Goal: Make the public repository understandable and useful for people who did
not watch the project evolve.

Current focus:
- Add the first rights-cleared public sample content package when the creator
  approval and sample-specific license text are complete.
- Provide a simple one-command self-hosting path once sample content exists.
- Keep README, screenshots, and feature GIFs aligned with what a self-hosted
  user can actually run from a clean checkout.
- Add issue templates and contribution labels after the sample content and
  public workflow are stable enough for outside reports.
- Keep contributor-facing docs in English where they define contracts or
  developer workflows; creator-facing guidance may be bilingual when helpful.

### 7. Engineering Health

Goal: Keep the codebase maintainable as more AI-assisted and external
contributions arrive.

Current focus:
- Keep `pnpm lint` honest: either add useful lint tasks or stop treating it as
  evidence of lint coverage.
- Split very large API and Reader implementation files when doing so reduces
  real maintenance risk.
- Add a minimal API/CMS round-trip smoke test for creating content with
  `panelId: null` Bubbles once the public sample and CI runtime are ready.

### 8. Future Private Commercial Platform

Goal: Hosted/commercial operations for Manga CMS. This is not part of the OSS deliverable.

Future private commercial work includes:
- Hosted creator registration and tenant operations.
- Paid checkout, purchase recovery, and reconciliation.
- Payout operations and revenue sharing.
- Custom domains and hosted tenant routing.
- Commercial CDN and object-storage adapters tied to specific business deployments.

These details will remain outside the public repository. The public repo may contain generic interfaces that allow them, but no specific business implementations.

## Standing Guardrails

These are ongoing constraints, not one-time milestones:

- Keep CI green and failures diagnosable.
- Keep schema, validation, Pack target validation, and content loading
  contracts stable.
- Keep `contents/` and `packs/` as canonical manga content unless an explicit
  migration changes the architecture.
- Keep Search Console, robots/sitemap, public Reader, Share URL, and OGP smoke
  checks green for self-hosted public launch.
- Keep generic manifest/export, role, rights, and entitlement designs
  provider-neutral.
- Keep private commercial platform details out of the public repository.

## Next Public Milestones

M1. Page Structure Review overlay connection
- Connect ingestion review-candidate overlays to the existing comparison UI.
- Keep candidate metadata out of canonical Bubble/public metadata.
- Refine warning density so editors see actionable items first.
- Preserve `panelId: null` and page-level Bubble workflows.

M2. Private-sample ingestion drill
- Run local private CSP/PSD/text-export drills without committing private
  assets.
- Record parser limitations without publishing private text, coordinates, or
  image details.
- Keep OCR/LLM as optional candidate generators only.

M3. First public sample content package
- Finalize sample-specific rights text with the creator.
- Verify GitHub inclusion, translation permission, OGP/screenshot use, text
  export/accessibility use, and commercial-sale prohibition.
- Add only public-safe, licensed sample assets when ready.
- This is the critical path for making content lint and Pack target validation
  meaningful in CI, improving the README first impression, and testing text
  export / translation import / feedback workflows on public data.

M4. Backup/restore drill
- Drill canonical `contents/`/`packs/` restore.
- Drill Postgres runtime-state restore separately.
- Confirm the two backup domains remain separate.

M5. CMS Reader preview and editorial workflow polish
- Add or improve Reader preview where editing decisions depend on reading flow.
- Refine text export, translation draft import, feedback triage, and proposal
  workflows against the first public sample.

M6. Public sharing artifact hardening
- Move OGP images toward generic immutable published artifacts in a
  provider-neutral manifest/export flow.
- Keep current dynamic OGP routes acceptable for beta while traffic is low.
- Treat static publish/export as the umbrella design for OGP artifacts,
  manifest output, and public free Episode hosting.
- Add creator attribution and canonical source URLs to official share cards
  when public-safety policy allows.
- Explore standards-based provenance, such as optional Content Credentials, and
  provider-neutral perceptual hash fields as published artifact metadata.

M7. Feature-flagged Reader text layer prototype
- Prototype only after public launch smoke, sample rights, and text exposure
  policy remain green.
- Keep it opt-in and off by default.

M8. Public adoption basics
- Add issue templates and contribution labels.
- Add public screenshots/GIFs from rights-cleared sample content.
- Use the lightweight release tag and changelog policy in
  [`docs/RELEASE.md`](docs/RELEASE.md).
- Add a one-command Docker Compose self-host path once the sample package is
  available.

## Idea Backlog

Future ideas that are useful but not yet committed as near-term milestones are
tracked in [`docs/IDEA-BACKLOG.md`](docs/IDEA-BACKLOG.md). The strongest current
candidate is a static publish/export target for public free Episodes, because
it also solves the long-term OGP artifact and manifest story.

## Review Checkpoints

Use external review when one of these boundaries changes:

- canonical content shape, schema validation, or Pack target validation;
- Page Structure Review candidate handling or ingestion overlay contracts;
- sample content rights text before committing content to Git;
- public Reader sharing, OGP, sitemap, robots, or indexing behavior;
- backup/restore procedure before relying on it for a live self-hosted install.
- production environment variable requirements or startup configuration;
- delivery token, auth token, or public URL formats.

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
- [`docs/IDEA-BACKLOG.md`](docs/IDEA-BACKLOG.md)
