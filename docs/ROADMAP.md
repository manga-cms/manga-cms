# Roadmap

Last updated: 2026-06-07

This document tracks the current public beta state and the path toward a stable public launch and later commercial launch.

## Overall Progress

| Target | Progress | Meaning |
|--------|---------:|---------|
| Public technical beta foundation | 100% | Free/public reading infrastructure with viewer, contents, API, CMS, publish/import, protected reading paths, and PoC validation tooling — foundation exit criteria met |
| First public content launch | 90% | Public GitHub release and production hosts are live with one readable Series; remaining work is search/analytics confirmation, content operations cleanup, and launch QA hardening |
| Commercial launch | 68% | Public launch foundation exists; Stripe buyout checkout, anonymous claim/recovery, reconciliation, paid-content operations, and multi-instance hardening remain |

## Public Launch Readiness

These percentages track the remaining path to putting a real public manga site in front of readers, not just whether the repository has the technical primitives.

| Area | Readiness | Notes |
|------|----------:|-------|
| Contract and source-of-truth | 94% | Series/Episode/Page/Panel/Bubble contracts, OpenAPI, domain types, schemas, content and Pack storage are in place |
| Public Reader functionality | 96% | API-backed reader, gating, focus targets, feedback, Pack display, Share URLs, localized metadata, language switch, and sitemap/robots exist |
| Reader mobile immersion | 85% | RTL keys/taps/swipe, image preload, double-tap zoom, and touch feel exist; blank-page prevention needs QA |
| CMS publish workflow | 80% | Create/edit/publish, scheduling, bulk episode visibility, image upload, ingestion, and page structure review exist |
| CMS structure editing UX | 88% | Drag editing, templates, zoom/pan, undo/redo stack, and textOriginal editing exist; high-resolution ergonomics remain |
| Ingestion and first content intake | 82% | Prepared directory import and Page Manifest JSON exist; real cleared assets and repeatable launch import checklist remain |
| Proposal and Pack governance | 92% | Feedback triage, Proposal Queue, Pack Drafts, canonical Pack export, translation import, and published Pack display exist |
| Rights and roles | 52% | Contract and admin API skeleton exist; CMS UI and enforcement in Pack/proposal workflows remain |
| Paid checkout and anonymous access recovery | 22% | Manual purchase/redeem and entitlement primitives exist; Stripe Checkout, webhook fulfillment, anonymous claim sessions, recovery keys, and refund/dispute automation remain |
| Production operations | 82% | Production hosts are live, API health is ready, Postgres runtime is in use, deploy docs exist, and GitHub public history is cleaned; monitoring, backup drills, R2/manifest, and multi-instance operations remain |
| Real public content readiness | 70% | Oumaga Dokidoki is live on production with ja/en Reader support; remaining work is canonical content seeding, metadata governance, Search Console visibility, and creator-facing launch polish |

Overall first public content launch readiness: 90%.

## Current Public State

As of 2026-06-07, the project has crossed from staging-only preparation into
a public production beta. The remaining roadmap is now mostly operational
hardening, content governance, and commercial readiness rather than first
reader enablement.

Confirmed public state:

- GitHub repository `manga-cms/manga-cms` is public. The public remote exposes a
  single clean `main` history for the OSS release, with old work branches
  removed from GitHub refs. Local private working branches may still exist on
  developer machines and are intentionally outside the public remote.
- `https://manga-cms.com/` returns the official site.
- `https://read.manga-cms.com/` serves the production Reader.
- `https://api.manga-cms.com/api/v1/health` reports production readiness with
  a healthy DB check and loaded content.
- Oumaga Dokidoki is readable as the first public content path.
- Reader Share URLs, Page/Panel OGP PNGs, localized Reader metadata,
  `robots.txt`, `sitemap.xml`, and English `noindex` gating exist in the public
  codebase.
- Cloudflare Web Analytics is the preferred lightweight launch analytics path.
  GA4 remains disabled for production unless consent handling is added later.

Important remaining work:

1. Confirm Search Console ownership and submit production sitemaps.
2. Confirm Cloudflare Web Analytics events appear in the dashboard for
   `manga-cms.com` and `read.manga-cms.com`.
3. Move Oumaga production metadata/content setup from manual runtime state to a
   repeatable seed, publish artifact, or manifest-backed process.
4. Add backup/restore drills for production Postgres and production content
   volume.
5. Add monitoring and alerting for API health, delivery failures, auth failures,
   feedback/proposal errors, and image generation failures.
6. Keep the current single-machine/API-volume assumption explicit until R2 and
   manifest delivery replace production image serving for public free content.
7. Defer paid checkout until Stripe webhook fulfillment, anonymous claim,
   recovery, refund/dispute handling, and reconciliation are implemented.

## Current Status

The project has moved beyond a viewer-only prototype.

- `contents/` is now the active source-of-truth path and is already read by shared loaders
- `packages/domain` contains shared types and a filesystem-backed content repository
- `packages/schemas` defines runtime validation for content and packs, and the repository now validates on load
- `apps/api` serves health, series, episode, reader, quote, clip, and reaction endpoints from `contents/`
- `apps/viewer` uses API-first SSR for runtime pages and shared-loader reads for prerendered pages and fallback
- Public reading routes are materially usable from real data across both viewer and API
- `apps/cms` now supports a minimal create/edit/publish loop that writes to `contents/`
- `drafts/`-backed ingestion jobs now support draft, review, confirm, and cancel flows before writing to `contents/`
- `packages/ingestion` now exists as an isolated PoC layer with artifact/draft separation, Gemini stub provider, local runner, and contract tests
- Dev auth, entitlement checks, gated reader responses, and token-based delivery are now connected end to end
- `@astrojs/node` SSR adapter is configured for production viewer builds
- `packages/db` now exists as the runtime-state persistence layer and is verified in SQLite dev mode
- API has DB-backed entitlements, ingestion, API keys, purchases, magic-link tokens, and audit fields wired through the runtime
- Dev auth is blocked in production (`NODE_ENV=production`), startup warns on default secrets
- Enhanced health endpoint reports DB status, environment, and readiness
- CI pipeline validates builds, Prisma client generation, and content schemas
- End-user production auth now exists via magic-link login, with one-time DB-backed tokens, rate limiting, and cleanup endpoint
- Local ingestion PoC now has deterministic contracts, runner output, and fast tests that guarantee artifact/canonical separation
- Delivery now enforces filesystem containment before serving page image bytes
- Reader/CMS/Rights responsibilities are now split into dedicated specs for reader UX, CMS UX, translation governance, and rights/permissions
- CMS Page Structure Review MVP exists for page-image preview, panel bbox editing, bubble bbox editing, and canonical episode save. Features like zoom/pan and undo/redo are implemented on main.
- Reader Feedback MVP exists for hidden Read Mode reporting, Explore Mode proposals, completion-card contribution, and private JSONL feedback storage
- Reader deep links can resolve `focus` URLs to Page / Panel / Bubble targets and open Explore Mode with the target highlighted
- Viewer Share URLs (`/s/...`), OGP Page/Panel generation, and `robots.txt`/`sitemap.xml` are implemented and smoke-tested on production Reader URLs. Localized metadata (ja/en) is functional on main.
- CMS features localized metadata editing, Text Export (Markdown/TSV), Translation Draft Import, and Feedback Triage capabilities.
- CMS Page Structure Review includes panel layout templates so storyboard/name pages can be structured quickly before manual fine-tuning
- Manga Content v2 has been accepted as a future schema-evolution direction,
  but not as an immediate rewrite. The current public launch continues on the
  existing Series / Episode / Page / Panel / Bubble contract while v2 is
  introduced through compatibility, validation, and migration tooling.
- The main remaining gaps are monitoring, Stripe buyout checkout, anonymous access claim/recovery, external commerce webhooks, OAuth/SSO, multi-instance hardening, CDN/watermark hardening, and post-launch API maintainability work
- Production architecture direction is now hybrid-first: keep Fly.io nrt for
  the Hono API and Astro SSR Viewer, move runtime state to Postgres before real
  paid sales, and add Cloudflare R2/manifest delivery for published immutable
  assets before traffic-heavy launch. See `docs/production-architecture.md`.

## Product Boundary Specs

The product boundary is now explicit:

- Reader: reading, sharing, approved pack display, lightweight proposals
- CMS: content structure editing, review, pack management, publishing, Reader preview
- Rights: role/language/pack scoped permissions for proposing, editing, reviewing, publishing, and commercial usage

## Manga Content v2 Schema Direction

The attached `manga-content-v2` proposal is adopted as the long-term content
schema direction, with important repository-specific adjustments.

Accepted:

- `contents/**/*.json` remains the canonical source of truth for manga content.
  Databases, search indexes, CDN manifests, viewer payloads, and normalized
  coordinate caches remain derived runtime artifacts.
- Page image files are immutable for metadata purposes. Spread composition,
  gutter/bleed trimming, and layout adjustments should be represented with
  non-destructive metadata such as `sourceCrop`, never by rewriting source
  images.
- Canonical geometry uses pixel coordinates, `xywh` bounding boxes, top-left
  origin, half-open bounds, and positive-area intersection semantics.
- Bounding boxes remain required for Panel and text-bearing regions. Precise
  shape, text area, ruby, emphasis, OCR confidence, and mask data are optional
  review metadata or future extensions.
- Spread support should use a deterministic Page-to-Spread projection model:
  axis-aligned `sourceCrop`, destination `bbox`, uniform scale, and a concrete
  1px placement tolerance. Rotation, skew, perspective, and arbitrary quad warp
  are out of scope for this phase.
- Translation and Pack data must reference stable source text IDs and must not
  overwrite canonical source text. Translation layout overrides belong to Packs,
  not to canonical Episode JSON.

Adjusted for this repository:

- The current public contract remains `Series -> Episode -> Page -> Panel ->
  Bubble`. Do not rename active public API, CMS UI, or Viewer concepts to
  `TextBlock` in one step.
- `TextBlock` can become the canonical v2 storage concept only behind a
  compatibility layer. Until migration is complete, loaders may expose existing
  `Bubble` domain objects to apps while accepting or producing v2-compatible
  data internally.
- Existing ID values must be preserved. A future `textBlockId` may reuse the
  existing `bubbleId` value, but the value itself must not change.
- Existing `Bubble.textOriginal` values must not change during migration.
- Legacy v1/v2-current input may be accepted at read and migration boundaries,
  but canonical v2 write output must be strict once the migration phase starts.
- The migration must not invent precise shapes, text areas, source crops,
  speaker identities, ruby, emphasis, or spread placements from bbox-only data.

Implementation order:

1. Write a dedicated design/spec document for this repository, for example
   `docs/manga-content-v2-spec.md`, using the current contract names and
   explicitly documenting the legacy `Bubble` to future `TextBlock`
   compatibility boundary.
2. Add schema/type prototypes without switching live content:
   `EpisodeV2CanonicalSchema`, legacy input schema, and a
   `normalizeEpisodeToV2` function.
3. Add validation and projection tests for bbox semantics, ID uniqueness,
   sourceCrop, spread placement, and `textRuns` consistency.
4. Add a dry-run migration command that reports changes and verifies that ID
   values and `textOriginal` values are preserved.
5. Only after dry-run validation passes on real content, decide whether to emit
   canonical v2 JSON or keep v2 as an internal normalized representation for
   longer.

Not on the immediate public-content launch critical path:

- Full canonical `TextBlock` replacement of `Bubble`
- Complete spread authoring UI
- Precise shape/mask annotation
- Translation Pack migration from `bubbleId` to `textBlockId`
- DB-backed canonical content storage

## UX Meta Review Decisions

Antigravity's UX review is mostly adopted. A few points were already partially addressed, and the adopted follow-up work is tracked below.

Accepted:

- ✅ Split the fat Viewer episode page. The components are extracted to `EpisodeReaderShell.astro` and `scripts/episode-reader.ts`.
- ✅ Improve mobile reader interaction quality. Preload, double-tap zoom, and touch polish are active.
- Reduce Study/Explore Mode information density on mobile. Explore exists, but the side panel should become a responsive bottom sheet or focused inspector so the manga image remains primary.
- Upgrade read-complete. Completion feedback exists, but a dedicated read-complete surface for next episode, reaction, contribution, and sharing is still needed.
- ✅ Add share/OGP depth. Page/Panel dynamic share images exist and production Reader smoke has passed; Clip/Quote OGP remains a launch-quality gap.
- ✅ Improve CMS structure editing. `PageStructureReview.tsx` now supports canvas zoom/pan, undo/redo, and keyboard shortcuts.
- ✅ Add a translation workspace. `TranslationDraftImport` and Draft export MVP are active.
- ✅ Continue improving Proposal/Pack next actions. Feedback Triage and Draft export workflows are integrated.

Not adopted as stated:

- Do not assume Edge Functions as the first OGP implementation. The first step is a renderer contract and server-side image generation path; edge deployment can come later.
- Do not make Reader a full editing surface. Reader remains lightweight proposal/reporting only; CMS owns editing and approval.

### Adopted UX Tasks

#### Viewer refactor and mobile reader polish

1. ✅ Extract Viewer episode page modules
2. ✅ Add image preload
3. ✅ Add touch polish (double-tap zoom, swipe thresholds)
4. Convert Explore panel on small screens:
   - bottom sheet layout
   - compact target summary
   - proposal form behind an explicit open action
5. Build read-complete surface:
   - next Episode action
   - reaction action
   - share action
   - contribution/report action
6. ✅ Add share image path (Page / Panel OGP route exists and production Reader smoke passed; Clip/Quote next)

#### CMS structure and translation polish

1. Split `PageStructureReview.tsx`:
   - page selector/sidebar
   - canvas/overlay editor
   - panel list
   - bubble list
   - inspector
   - script assist
   - review decision helpers
2. ✅ Add canvas zoom/pan (zoom controls, clamp logic)
3. ✅ Add editing safety (undo/redo stack, keyboard shortcuts)
4. ✅ Add translation workspace MVP (`TranslationDraftImport`, textOriginal preservation)
5. ✅ Improve workflow next actions (Feedback triage, Draft adoption)

Authoritative specs:

- `docs/reader-ux-spec.md`
- `docs/feedback-mvp-spec.md`
- `docs/cms-ux-spec.md`
- `docs/translation-governance-spec.md`
- `docs/rights-permission-spec.md`
- `docs/storyboard-data-import.md`

## Phase Roadmap

| Phase | Goal | Progress | Exit criteria |
|------|------|---------:|---------------|
| 1 | Domain and source-of-truth foundation | 93% | `contents/`, `packs/`, shared types, shared schemas, and repository interfaces are stable enough to build on |
| 1.5 | Manga Content v2 schema evolution | 35% | v2 principles are accepted; `schemaVersion: 2` extension and `textOriginal` boundary are implemented/documented in branch. Canonical v2 schema, compatibility layer, and dry-run migration remain unimplemented. |
| 2 | Public reader MVP | 98% | Works, work detail, episode, quote, clip, reaction, normal/explore reading, focus links, and lightweight feedback are usable from real repository data |
| 3 | Runtime integration | 89% | Viewer and API use the same contracts and the API can serve the public reading surface |
| 4 | CMS and publish MVP | 92% | A creator can set up a work, add episodes/pages, template page structure, review, and publish without editing JSON manually |
| 5 | Ingestion MVP | 84% | Upload/import, draft generation, review queue, confirmation jobs, and PoC evaluation tooling exist |
| 6 | Commerce, entitlement, and delivery | 68% | Purchase/redeem, entitlement checks, gated delivery URLs, and watermark-capable delivery primitives exist; Stripe buyout checkout, webhook fulfillment, anonymous claim/recovery, and reconciliation remain |
| 7 | Production hardening | 82% | Production deploy target, Postgres runtime, CI/CD, env gates, and basic health checks are in place; observability, backup drills, incident response, and multi-instance assumptions remain |
| 7.5 | Published asset and CDN migration | 10% | `contents/` remains canonical while published images, core JSON, Pack JSON, and `manifest.json` are exported to R2 with cache rules and immutable revision keys |
| 7.6 | Public share URLs, metadata, and OGP | 94% | Share facade, localized metadata, language switches, Page/Panel OGP PNG, and `schemaVersion: 2` extension are implemented; production Reader smoke passed, SNS crawler QA remains |
| 8 | Scale and polish | 62% | Auth and runtime primitives exist; CDN/R2, monitoring, scheduled cleanup, Redis-backed rate limits, OAuth/SSO, and commercial operations remain |

## Next Milestones

### Reader UX and sharing priorities

The next viewer work should preserve a strong normal reading experience before
adding more visible structure.

Priority A:

- Separate `normal` reading mode from `study` mode
- Keep structure overlays hidden in normal mode
- Keep proposal UI lightweight in Reader; full editing belongs in CMS
- Keep report/proposal UI hidden until target interaction in Read Mode
- ✅ Support Page / Panel / Bubble URL resolution
- ✅ Add canonical path URLs for share pages so OGP does not depend on fragments
- ✅ Add selected target highlighting
- ✅ Add basic share link generation
- ✅ Add Page OGP first (implemented and smoke-tested on production Reader URLs)
- Add read-complete card
- Add official Quote, official Clip, and official Reaction records
- Add `spoiler_level` and `share_policy`

Priority B:

- Reaction use-case tags
- Character quote lists after speaker metadata is reliable
- localStorage reading progress and favorite quote/panel save
- Footnote Pack UI
- Author commentary surfaced after reading
- Translation comparison and translation review modes
- Proposal Queue surfaced from Reader submissions and reviewed in CMS
- CMS Feedback Triage for private Reader feedback records
- Pack Manager MVP for Translation Pack and Footnote Pack
- Rights/Role Manager MVP for language-specific translation work

Priority C:

- User-generated public Clip creation
- External Embed
- Public Community Proposal UI
- Contributor Reward payout
- Pack Marketplace
- Accessibility reading
- Large-scale dynamic OGP generation

### Phase 1: Finish the content foundation

- Tighten `contents/` and `packs/` schemas until they can be treated as stable source-of-truth contracts
- Decide what remains filesystem-backed and what will move behind DB-backed repositories later
- Add tests or CLI validation so malformed source content is caught in CI, not only at runtime
- Split internal content IDs from human-facing display refs
- Add Edition metadata for web, volume, revised, color, vertical scroll, and international versions
- Add URL alias resolution rules for old display refs

### Phase 1.5: Manga Content v2 schema evolution

This phase adopts the `manga-content-v2` proposal as a compatibility-first
schema evolution, not an immediate replacement of the active contract.

- ✅ Create `docs/manga-content-v2-spec.md`
- ✅ Keep the live app-facing vocabulary as Series / Episode / Page / Panel / Bubble
- Prototype v2 canonical schemas (`schemaVersion: 2` is introduced as optional extension, but full v2 prototype remains)
- ✅ Add an input-vs-canonical separation (`textOriginal` separation from layout)
- Add deterministic geometry helpers:
  - half-open bbox intersection
  - positive-area clipping
  - sourceCrop defaulting
  - Page-to-Spread projection
  - uniform-scale validation with 1px placement tolerance
- Add migration dry-run tooling:
  - preserve all existing ID values
  - preserve all existing `textOriginal` values
  - populate image dimensions, mime type, and sha256 where possible
  - mark bbox-only migrated geometry honestly instead of inventing shapes
- Add schema and migration tests before writing canonical v2 output.
- Defer any public API rename from Bubble to TextBlock until Reader, CMS,
  Packs, and OpenAPI can move together.

### Phase 2: Finish public reading

- ✅ Polish reader interactions: panel highlighting, zoom behavior, bubble targeting, and deep-link behavior
- ✅ Normal/study mode separation exists
- Read-complete card exists; next step is improving next-episode/share/official-quote actions
- ✅ Add Page OGP (implemented and smoke-tested on production Reader URLs)
- Add official Quote, official Clip, and official Reaction surfaces before user-generated sharing
- Add spoiler_level and share_policy to shareable units
- ✅ Run a real deployment rehearsal with production viewer build + API + DB-backed mode

### Phase 3: Complete viewer/API integration

- Keep the viewer thin: rendering only, no scattered lookup logic
- Align implementation with `openapi.yaml`, especially reader payloads and delivery URL behavior
- Decide whether loader fallback stays as a dev-only feature or is removed after API stability improves
- Consolidate API response types so viewer-side runtime contracts are shared instead of duplicated
- Ensure share pages use server-visible path URLs, while fragments remain only for in-reader navigation

### Phase 4: Build the publish path

- Add admin authentication and authorization to all write endpoints
- ✅ Expand editing beyond page-level entry so panel/bubble structures can be edited in CMS
- Replace cache-reload internals with an explicit invalidation/reload mechanism
- Add safer validation and error UX around publish failures
- Add CMS fields for official Quote / Clip / Reaction curation
- Add CMS controls for spoiler_level and share_policy
- ✅ Expand CMS Page Structure Review with ingestion candidate approval, reading-order tools, and proposal handling
- ✅ Add Bubble Editor as the main workspace for translation, footnotes, comments, speaker, and proposals
- Add Reader preview inside CMS so pack quality can be judged in reading context

### Phase 4.5: Translation, proposal, and pack governance

- Add Proposal Queue for translation, typo, footnote, commentary, tag, and structure proposals
- Add Translation Workspace with original text, current translation, target language, glossary, character voice, bubble fit, and surrounding panels
- Add Pack Manager with draft, in_review, approved, published, deprecated, and archived statuses
- Add Rights/Role Manager with owner, editor, translator, reviewer, contributor, moderator, and viewer roles
- Keep translation proposals separate from official translation rights and pack publication rights

### Phase 4.75: Anonymous buyout commerce

Define the paid launch direction around Stripe Checkout, anonymous access recovery, and entitlement reconciliation.
This is intentionally not part of the open source release or free public launch
critical path.

- Use Stripe Checkout Sessions API as the P0 payment provider
- Keep the first paid launch buyout-only; defer subscriptions and recurring billing
- Keep `Entitlement` as the server-side right to read
- Add a `PaymentProvider` boundary so KOMOJU, manual sales, and gift-code sales can be added later
- Evolve the current `PurchaseRecord` or introduce `PaymentOrder` only after a schema review
- Persist provider webhook events for idempotency, retry, dedupe, and reconciliation
- Issue only opaque HttpOnly cookie sessions to anonymous buyers
- Store only HMAC hashes of session, recovery, support, and installation secrets
- Add anonymous purchase recovery before accepting real paid sales
- Revoke or suspend access on refund/dispute according to the documented business rule

### Phase 5: Build ingestion

- Add richer validation and review UX around ingestion draft failures
- Support asset attachment or image-path import in a less manual way
- Expand beyond the current deterministic PoC to compare multiple source input levels (image-only vs text export)
- Leave OCR/panel detection sophistication for later; first keep the pipeline operable, measurable, and auditable
- Keep speaker metadata optional at first; use it for character quote lists only when reliable

### Phase 7: Harden for production

- ✅ Astro SSR adapter (`@astrojs/node` standalone) configured for viewer production builds
- ✅ `packages/db` Prisma schema with Entitlement and IngestionJob models
- ✅ Workspace packages build to `dist/` with NodeNext module resolution — `pnpm --filter @manga/api start` works
- ✅ Dev auth blocked when `NODE_ENV=production`; startup warns on default secrets
- ✅ Enhanced `/health` endpoint with DB status, environment, and readiness info
- ✅ CI pipeline (`.github/workflows/ci.yml`) for builds, Prisma, and content validation
- ✅ `.env.example` documenting all environment variables
- ✅ `prisma db push` works — SQLite dev.db with all 5 tables confirmed
- ✅ `/deliver/:pageId` now verifies resolved image paths remain inside the episode asset directory
- Next required production step: move runtime state from SQLite-on-volume to a
  Postgres provider before real paid sales or multi-instance operation.
- Remaining: full monitoring stack, production incident response, Postgres
  backup/restore rehearsal, content-volume recovery drill, and deeper recovery drills

### Phase 7.5: Published asset and CDN migration

Adopt `docs/production-architecture.md` as the production architecture
direction. This phase incorporates the useful part of the Cloudflare-first
proposal without replacing the current API/Viewer stack in one step.

- Keep `contents/` and `packs/` as canonical editorial source-of-truth.
- Keep Fly.io `nrt` as the first production runtime for the Hono API and Astro
  SSR Viewer.
- Add Cloudflare R2 as the published artifact store for immutable page images,
  core JSON, Pack JSON, and small `manifest.json` pointers.
- Add revisioned object keys such as
  `series/{seriesId}/episodes/{episodeId}/pages/{pageId}/rev-000001.webp`.
- Make only `manifest.json` mutable; revisions are append-only.
- Add cache headers and Cloudflare Cache Rules for JSON and images.
- Update public Reader paths to prefer manifest/R2 assets for public free
  reading, while preserving API-backed gated, admin, feedback, and commerce
  flows.
- Treat Cloudflare Workers and D1 as optional future adapters, not as the first
  production migration target.

Exit criteria:

- A publish/export command can emit revisioned published assets from canonical
  `contents/` and `packs/`.
- Viewer can read at least one public Episode through `manifest.json` and R2
  asset URLs.
- Protected/gated Episodes do not expose raw origin image paths.
- Cache behavior for `manifest.json`, revisioned JSON, and images is documented
  and smoke-tested.
- Rollback can be performed by moving the manifest pointer and recording the
  operational action.

### Phase 7.6: Public share URLs, metadata, and OGP

Use `docs/public-share-metadata-roadmap.md` as the implementation order for
public share work. Do not start with dynamic OGP image generation; first make
the content metadata source of truth explicit.

Order:

1. Extend or version the content JSON metadata contract.
2. Define canonical public Share URLs separately from Reader URLs.
3. Implement SSR title, description, canonical, and language metadata.
4. Add Page OGP first, then Panel OGP as public-safe preview artifacts.
5. Run SNS crawler QA after revisioned metadata and image URLs are stable.

Exit criteria:

- ✅ Existing Reader URLs remain compatible.
- ✅ Share URLs do not rely on URL fragments for crawler metadata.
- ✅ `schemaVersion: 2` content still loads, or a documented migration exists.
- ✅ SSR can emit localized metadata without client-side JavaScript.
- ✅ Dynamic Page/Panel OGP URLs exist with safe fallback behavior. Immutable,
  revisioned OGP artifacts remain part of the Phase 7.5 R2/manifest path.
- ✅ No raw `contents/`, delivery token, local-only, draft, feedback, Proposal, or
  Pack draft data is exposed in public Share HTML.

### Phase 8: Scale and polish

- ✅ DB-backed ingestion jobs (`DbIngestionRepository` via Prisma)
- ✅ API key auth for production admin access (`X-API-Key` header)
- ✅ Purchase records with idempotency (`providerPurchaseId` unique constraint)
- ✅ Redeem codes with atomic transaction + CAS concurrency guard
- ✅ Magic link email auth (`POST /auth/login` → email → `GET /auth/verify` → session cookie)
- ✅ Email provider: Resend with console fallback (`RESEND_API_KEY`), fail-closed in production
- ✅ DB-backed one-time tokens with SHA-256 hash, 15-min TTL, atomic verify
- ✅ Session cookies: HttpOnly, SameSite=Lax, Secure in production
- ✅ Rate limiting on `/auth/login` (email + IP dual key)
- ✅ Token lifecycle: `POST /admin/auth/cleanup` for expired/consumed token cleanup
- ✅ Purchase audit: `createdBy`, `metadata` fields; RedeemCode `redeemedIp`; MagicLinkToken `requestIp`
- ✅ Proxy trust boundary is explicit via `TRUST_PROXY`; spoofable `X-Forwarded-For` is ignored by default
- Session policy: HMAC-signed cookies (stateless); revocation requires secret rotation (documented)
- Remaining: OAuth/SSO, Stripe Checkout buyout flow, webhook fulfillment, anonymous claim/recovery, scheduled cleanup automation, Redis-backed rate limiting for multi-instance, CDN, full monitoring, API route modularization, Zod validator consolidation, and Prisma schema source-of-truth cleanup
- Cloudflare Workers/D1 may be revisited here only after Phase 7.5 proves the
  manifest/R2 delivery model and a concrete cost or operations benefit exists.

## Launch Path

### To stabilize the current public beta

The public beta is live. The next work is to make it repeatable and observable.

1. Finish search and analytics verification:
   - confirm Search Console Domain property ownership
   - submit `manga-cms.com` and `read.manga-cms.com` sitemaps
   - confirm Cloudflare Web Analytics events in the dashboard
2. Make production content reproducible:
   - document or automate Oumaga content restore from a rights-cleared source
   - move runtime-only metadata patches into a seed, publish artifact, or manifest
   - keep GitHub repository free of manga assets unless separately licensed
3. Run production backup/recovery drills:
   - Postgres snapshot/restore
   - production content volume backup/restore
   - rollback for the official site and Reader deploys
4. Add launch monitoring:
   - API health and DB readiness
   - image delivery failures
   - OGP image generation failures
   - feedback/proposal errors
5. If traffic or image volume increases, run the Phase 7.5 R2/manifest delivery
   path before a larger public announcement.

### To reach commercial launch

1. Replace single-instance assumptions:
   - Postgres-backed runtime state instead of SQLite-on-volume
   - Redis-backed rate limiter
   - scheduled token cleanup
2. Add external commerce wiring:
   - Stripe Checkout Sessions as the P0 buyout provider
   - PaymentProvider abstraction for future KOMOJU, manual, and gift-code sales
   - webhook receipt with raw signature verification and idempotent fulfillment
   - checkout claim with opaque HttpOnly session cookie
   - anonymous purchase recovery and support recovery
   - refund/dispute access revocation
   - reconciliation/idempotency verification
3. Improve identity and operations:
   - OAuth/SSO or equivalent production identity strategy
   - monitoring, alerts, and error reporting
   - backup/recovery drill
4. Finalize delivery edge posture:
   - R2/manifest published asset delivery
   - CDN strategy and Cloudflare Cache Rules
   - cache behavior
   - watermark/delivery observability

## Progress Rules

Update this file when one of the following happens:

- a phase exit criterion is materially closer to complete
- a new cross-cutting system is connected for the first time
- launch assumptions change
- a review reveals that a percentage was clearly too optimistic

Do not update percentages for tiny refactors or cosmetic changes.

## Notes on Percentages

- These percentages are directional, not mathematical truth
- `Public beta` and `Commercial launch` are tracked separately on purpose
- A strong viewer does not imply strong publish or operations progress
- If a subsystem exists only in specs or stubs, it should stay low even if the design is strong
