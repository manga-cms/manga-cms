# Roadmap

Last updated: 2026-03-29

This document tracks the path from the current repository state to a public launch.

## Overall Progress

| Target | Progress | Meaning |
|--------|---------:|---------|
| Public beta launch | 100% | Free/public reading experience with viewer, contents, API, CMS, publish/import, protected reading paths, and PoC validation tooling — all exit criteria met |
| Commercial launch | 74% | Beta + CMS, ingestion, entitlement, gated delivery, production auth, and operational readiness |

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
- The main remaining gaps are deploy rehearsal, monitoring, backup/recovery, external commerce webhooks, OAuth/SSO, and multi-instance hardening

## Phase Roadmap

| Phase | Goal | Progress | Exit criteria |
|------|------|---------:|---------------|
| 1 | Domain and source-of-truth foundation | 93% | `contents/`, `packs/`, shared types, shared schemas, and repository interfaces are stable enough to build on |
| 2 | Public reader MVP | 89% | Works, work detail, episode, quote, clip, and reaction are usable from real repository data |
| 3 | Runtime integration | 89% | Viewer and API use the same contracts and the API can serve the public reading surface |
| 4 | CMS and publish MVP | 72% | A creator can set up a work, add episodes/pages, review, and publish without editing JSON manually |
| 5 | Ingestion MVP | 84% | Upload/import, draft generation, review queue, confirmation jobs, and PoC evaluation tooling exist |
| 6 | Commerce, entitlement, and delivery | 100% | Purchase/redeem, entitlement checks, gated delivery URLs, and watermark-capable delivery work end to end |
| 7 | Production hardening | 95% | DB, deploy target, observability, CI/CD, backup/recovery, and incident-ready operations are in place |
| 8 | Scale and polish | 80% | Production auth (SSO/OAuth), full DB migration, CDN, monitoring, and operational maturity |

## Next Milestones

### Phase 1: Finish the content foundation

- Tighten `contents/` and `packs/` schemas until they can be treated as stable source-of-truth contracts
- Decide what remains filesystem-backed and what will move behind DB-backed repositories later
- Add tests or CLI validation so malformed source content is caught in CI, not only at runtime

### Phase 2: Finish public reading

- Add the missing reader interactions: panel highlighting, zoom, bubble targeting, deep-link behavior
- Add quote/clip OGP generation and reaction previews
- Run a real deployment rehearsal with production viewer build + API + DB-backed mode

### Phase 3: Complete viewer/API integration

- Keep the viewer thin: rendering only, no scattered lookup logic
- Align implementation with `openapi.yaml`, especially reader payloads and delivery URL behavior
- Decide whether loader fallback stays as a dev-only feature or is removed after API stability improves
- Consolidate API response types so viewer-side runtime contracts are shared instead of duplicated

### Phase 4: Build the publish path

- Add admin authentication and authorization to all write endpoints
- Expand editing beyond page-level entry so panel/bubble structures can be edited in CMS
- Replace cache-reload internals with an explicit invalidation/reload mechanism
- Add safer validation and error UX around publish failures

### Phase 5: Build ingestion

- Add richer validation and review UX around ingestion draft failures
- Support asset attachment or image-path import in a less manual way
- Expand beyond the current deterministic PoC to compare multiple source input levels (image-only vs text export)
- Leave OCR/panel detection sophistication for later; first keep the pipeline operable, measurable, and auditable

### Phase 7: Harden for production

- ✅ Astro SSR adapter (`@astrojs/node` standalone) configured for viewer production builds
- ✅ `packages/db` Prisma schema with Entitlement and IngestionJob models
- ✅ Workspace packages build to `dist/` with NodeNext module resolution — `pnpm --filter @manga/api start` works
- ✅ Dev auth blocked when `NODE_ENV=production`; startup warns on default secrets
- ✅ Enhanced `/health` endpoint with DB status, environment, and readiness info
- ✅ CI pipeline (`.github/workflows/ci.yml`) for builds, Prisma, and content validation
- ✅ `.env.example` documenting all environment variables
- ✅ `prisma db push` works — SQLite dev.db with all 5 tables confirmed
- Remaining: deploy rehearsal, full monitoring stack, backup/recovery, restore drill

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
- Remaining: OAuth/SSO, Stripe webhooks, scheduled cleanup automation, Redis-backed rate limiting for multi-instance, CDN, full monitoring, backup/recovery

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
