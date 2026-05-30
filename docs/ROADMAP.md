# Roadmap

Last updated: 2026-05-30

This document tracks the path from the current repository state to a public launch.

## Overall Progress

| Target | Progress | Meaning |
|--------|---------:|---------|
| Public technical beta foundation | 100% | Free/public reading infrastructure with viewer, contents, API, CMS, publish/import, protected reading paths, and PoC validation tooling — foundation exit criteria met |
| First public content launch | 72% | The platform can publish, but a release-quality first Series still needs cleared assets, stronger mobile reader QA, CMS editing polish, and launch smoke rehearsal |
| Commercial launch | 76% | Beta + CMS, ingestion, entitlement, gated delivery, production auth, and operational readiness |

## Public Launch Readiness

These percentages track the remaining path to putting a real public manga site in front of readers, not just whether the repository has the technical primitives.

| Area | Readiness | Notes |
|------|----------:|-------|
| Contract and source-of-truth | 94% | Series/Episode/Page/Panel/Bubble contracts, OpenAPI, domain types, schemas, content and Pack storage are in place |
| Public Reader functionality | 84% | API-backed reader, gating, publication windows, focus targets, feedback, and Pack display exist; mobile polish and share surfaces remain |
| Reader mobile immersion | 58% | RTL keys/taps/swipe exist, but preload, double-tap zoom, touch feel, and blank-page prevention need dedicated QA and polish |
| CMS publish workflow | 80% | Create/edit/publish, scheduling, bulk episode visibility, image upload, ingestion, and page structure review exist |
| CMS structure editing UX | 64% | Drag editing and templates exist; zoom/pan, undo/redo, autosave/dirty guard, and high-resolution editing ergonomics remain |
| Ingestion and first content intake | 82% | Prepared directory import and Page Manifest JSON exist; real cleared assets and repeatable launch import checklist remain |
| Proposal and Pack governance | 78% | Feedback triage, Proposal Queue, Pack Drafts, adoption, canonical Pack export, and published Pack display exist |
| Rights and roles | 52% | Contract and admin API skeleton exist; CMS UI and enforcement in Pack/proposal workflows remain |
| Production operations | 70% | CI, production build, DB-backed runtime pieces, magic links, delivery containment, and env checks exist; monitoring, CDN, backups, cleanup jobs, and incident drills remain |
| Real public content readiness | 25% | Requires rights-cleared artwork/story/lettering/translations/comments and a confirmed launch positioning |

Overall first public content launch readiness: 72%.

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
- CMS Page Structure Review MVP exists for page-image preview, panel bbox editing, bubble bbox editing, and canonical episode save
- Reader Feedback MVP exists for hidden Read Mode reporting, Explore Mode proposals, completion-card contribution, and private JSONL feedback storage
- Reader deep links can resolve `focus` URLs to Page / Panel / Bubble targets and open Explore Mode with the target highlighted
- CMS Page Structure Review includes panel layout templates so storyboard/name pages can be structured quickly before manual fine-tuning
- The main remaining gaps are monitoring, external commerce webhooks, OAuth/SSO, multi-instance hardening, CDN/watermark hardening, and post-launch API maintainability work

## Product Boundary Specs

The product boundary is now explicit:

- Reader: reading, sharing, approved pack display, lightweight proposals
- CMS: content structure editing, review, pack management, publishing, Reader preview
- Rights: role/language/pack scoped permissions for proposing, editing, reviewing, publishing, and commercial usage

## UX Meta Review Decisions

Antigravity's UX review is mostly adopted. A few points were already partially addressed, and the adopted follow-up work is tracked below.

Accepted:

- Split the fat Viewer episode page. `apps/viewer/src/pages/works/[workId]/episodes/[episodeId].astro` is about 1,950 lines and mixes SSR data loading, metadata, reader layout, study panel UI, feedback modal, and client-side reader interactions.
- Improve mobile reader interaction quality. Basic RTL tap/key/swipe exists, but native-feeling page movement, double-tap zoom, and image preload/blank-page prevention need focused work.
- Reduce Study/Explore Mode information density on mobile. Explore exists, but the side panel should become a responsive bottom sheet or focused inspector so the manga image remains primary.
- Upgrade read-complete. Completion feedback exists, but a dedicated read-complete surface for next episode, reaction, contribution, and sharing is still needed.
- Add share/OGP depth. Episode OGP exists; Page/Clip/Quote dynamic share images remain a launch-quality gap.
- Improve CMS structure editing. `PageStructureReview.tsx` is about 930 lines and supports drag editing, but high-resolution editing needs zoom/pan and better precision controls.
- Add CMS undo/redo, dirty guard, and local autosave for structure review.
- Add a translation workspace with surrounding context, not only isolated Bubble editing.
- Continue improving Proposal/Pack next actions. Accepted Proposal to Pack Draft adoption is now present, but workflow-level guidance and status surfacing can be clearer.

Not adopted as stated:

- Do not assume Edge Functions as the first OGP implementation. The first step is a renderer contract and server-side image generation path; edge deployment can come later.
- Do not make Reader a full editing surface. Reader remains lightweight proposal/reporting only; CMS owns editing and approval.

### Adopted UX Tasks

#### Viewer refactor and mobile reader polish

1. Extract Viewer episode page modules:
   - data resolution and metadata helpers
   - reader toolbar
   - reader frame/page renderer
   - study/explore panel
   - feedback modal
   - client reader controller script
2. Add image preload:
   - preload current, previous, and next Page images
   - keep current page visible until next image is decoded
   - add blank-page prevention state for slow delivery URLs
3. Add touch polish:
   - swipe threshold tuning for RTL reading
   - double-tap zoom to panel/page focus
   - pinch/drag-safe behavior without triggering accidental page turns
4. Convert Explore panel on small screens:
   - bottom sheet layout
   - compact target summary
   - proposal form behind an explicit open action
5. Build read-complete surface:
   - next Episode action
   - reaction action
   - share action
   - contribution/report action
6. Add share image path:
   - Page OGP first
   - Clip/Quote OGP after official Clip/Quote records exist
   - avoid exposing raw origin image paths

#### CMS structure and translation polish

1. Split `PageStructureReview.tsx`:
   - page selector/sidebar
   - canvas/overlay editor
   - panel list
   - bubble list
   - inspector
   - script assist
   - review decision helpers
2. Add canvas zoom/pan:
   - zoom in/out/reset controls
   - pan mode
   - fit-to-width and fit-to-screen presets
   - coordinate conversion tests for bbox editing
3. Add editing safety:
   - undo/redo stack
   - keyboard shortcuts
   - dirty state and browser unload guard
   - local autosave or recoverable draft cache
4. Add translation workspace MVP:
   - selected Bubble editor
   - previous/next Bubble context
   - previous/next Panel context
   - glossary/voice memo placeholder
   - proposal or Pack Draft write path kept explicit
5. Improve workflow next actions:
   - after feedback converts to proposal, show proposal destination and next action
   - after proposal is accepted, surface compatible Pack Drafts and adoption state
   - after Pack Draft export, show canonical Pack and Reader availability state

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
| 2 | Public reader MVP | 94% | Works, work detail, episode, quote, clip, reaction, normal/explore reading, focus links, and lightweight feedback are usable from real repository data |
| 3 | Runtime integration | 89% | Viewer and API use the same contracts and the API can serve the public reading surface |
| 4 | CMS and publish MVP | 79% | A creator can set up a work, add episodes/pages, template page structure, review, and publish without editing JSON manually |
| 5 | Ingestion MVP | 84% | Upload/import, draft generation, review queue, confirmation jobs, and PoC evaluation tooling exist |
| 6 | Commerce, entitlement, and delivery | 100% | Purchase/redeem, entitlement checks, gated delivery URLs, and watermark-capable delivery work end to end |
| 7 | Production hardening | 96% | DB, deploy target, observability, CI/CD, backup/recovery, and incident-ready operations are in place |
| 8 | Scale and polish | 80% | Production auth (SSO/OAuth), full DB migration, CDN, monitoring, and operational maturity |

## Next Milestones

### Reader UX and sharing priorities

The next viewer work should preserve a strong normal reading experience before
adding more visible structure.

Priority A:

- Separate `normal` reading mode from `study` mode
- Keep structure overlays hidden in normal mode
- Keep proposal UI lightweight in Reader; full editing belongs in CMS
- Keep report/proposal UI hidden until target interaction in Read Mode
- Support Page / Panel / Bubble URL resolution
- Add canonical path URLs for share pages so OGP does not depend on fragments
- Add selected target highlighting
- Add basic share link generation
- Add Page OGP first
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

### Phase 2: Finish public reading

- Polish reader interactions: panel highlighting, zoom behavior, bubble targeting, and deep-link behavior now exist but need browser QA across mobile/tablet/desktop
- Normal/study mode separation exists; keep normal reading visually quiet as more pack UI is added
- Read-complete card exists; next step is improving next-episode/share/official-quote actions
- Add Page OGP, then official Quote/Clip/Reaction OGP
- Add official Quote, official Clip, and official Reaction surfaces before user-generated sharing
- Add spoiler_level and share_policy to shareable units
- Run a real deployment rehearsal with production viewer build + API + DB-backed mode

### Phase 3: Complete viewer/API integration

- Keep the viewer thin: rendering only, no scattered lookup logic
- Align implementation with `openapi.yaml`, especially reader payloads and delivery URL behavior
- Decide whether loader fallback stays as a dev-only feature or is removed after API stability improves
- Consolidate API response types so viewer-side runtime contracts are shared instead of duplicated
- Ensure share pages use server-visible path URLs, while fragments remain only for in-reader navigation

### Phase 4: Build the publish path

- Add admin authentication and authorization to all write endpoints
- Expand editing beyond page-level entry so panel/bubble structures can be edited in CMS; template-assisted panel creation now exists, but bubble auto-detection/import still needs ingestion integration
- Replace cache-reload internals with an explicit invalidation/reload mechanism
- Add safer validation and error UX around publish failures
- Add CMS fields for official Quote / Clip / Reaction curation
- Add CMS controls for spoiler_level and share_policy
- Expand CMS Page Structure Review with ingestion candidate approval, reading-order tools, and proposal handling
- Add Bubble Editor as the main workspace for translation, footnotes, comments, speaker, and proposals
- Add Reader preview inside CMS so pack quality can be judged in reading context

### Phase 4.5: Translation, proposal, and pack governance

- Add Proposal Queue for translation, typo, footnote, commentary, tag, and structure proposals
- Add Translation Workspace with original text, current translation, target language, glossary, character voice, bubble fit, and surrounding panels
- Add Pack Manager with draft, in_review, approved, published, deprecated, and archived statuses
- Add Rights/Role Manager with owner, editor, translator, reviewer, contributor, moderator, and viewer roles
- Keep translation proposals separate from official translation rights and pack publication rights

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
- Remaining: full monitoring stack, production incident response, and deeper recovery drills

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
- Remaining: OAuth/SSO, Stripe webhooks, scheduled cleanup automation, Redis-backed rate limiting for multi-instance, CDN, full monitoring, API route modularization, Zod validator consolidation, and Prisma schema source-of-truth cleanup

## Launch Path

### To reach public beta launch

1. Run a full deployment rehearsal:
   - viewer production build
   - API in DB-backed mode
   - SQLite/Postgres bootstrap
   - real secrets/env validation
2. Finish the last reader-facing gaps:
   - panel highlight / zoom / deep-link polish
   - quote/clip OGP generation
3. Add a small smoke-test checklist:
   - login
   - purchase/redeem
   - gated episode read
   - publish from CMS
4. Ensure rollback basics exist:
   - DB snapshot/export
   - content backup
   - restore instructions

### To reach commercial launch

1. Replace single-instance assumptions:
   - Redis-backed rate limiter
   - scheduled token cleanup
2. Add external commerce wiring:
   - Stripe/Gumroad webhook path
   - reconciliation/idempotency verification
3. Improve identity and operations:
   - OAuth/SSO or equivalent production identity strategy
   - monitoring, alerts, and error reporting
   - backup/recovery drill
4. Finalize delivery edge posture:
   - CDN strategy
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
