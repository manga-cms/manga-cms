# Integration Status

Current state of the manga-cms monorepo integration.

See also: [ROADMAP.md](./ROADMAP.md) for launch phases and progress percentages.

## Data Flow

```
apps/cms (React SPA, port 5173)
  ↓ POST/PUT
apps/api /admin/* endpoints (Hono, port 3000)
  ↓ writes via FileContentWriter
contents/ (JSON files, Zod-validated on read)
  ↓ read by FileContentRepository
apps/api        → HTTP read endpoints
apps/viewer     → SSR (API-first) + prerender (loader)
```

## What's Connected

| Layer | Source | Status |
|-------|--------|--------|
| **contents/** | `series.json` + `{episodeId}/episode.json` per series | ✅ Real data |
| **packs/** | `pack.json` per pack | ✅ Structure defined |
| **packages/domain** | Types + `FileContentRepository` (Zod-validated) | ✅ Reads & validates contents/ |
| **packages/schemas** | Zod schemas for content/pack validation | ✅ Used by content-loader |
| **apps/api** (read) | Hono API — 8 read endpoints, contents/-backed | ✅ Runtime |
| **apps/api** (write) | 5 admin endpoints — create/update series/episodes, publish | ✅ Writes to contents/ |
| **apps/viewer** (prerender) | Home, Works, Work detail — `content.ts` (loader) | ✅ Build-time |
| **apps/viewer** (SSR) | Episode, Quote, Clip, Reaction — `api-client.ts` (API-first) | ✅ API primary, loader fallback |
| **apps/cms** | React SPA — Dashboard, Create Work, Work Detail, Episode Editor, Publish | ✅ Functional MVP |
| **packages/db** | Prisma client + repositories for entitlement/ingestion/api key/purchase | ✅ SQLite dev, 5 tables confirmed |
| **Auth / Entitlement** | Dev auth, admin guard, grant/check/list/revoke | ✅ MVP connected |
| **Delivery** | Token-verified `/deliver/:pageId` + gated reader payloads | ✅ MVP connected |

## Running Locally

```bash
pnpm install

# Generate Prisma client (required once)
cd packages/db && pnpm db:generate && cd ../..

# Optional: set up SQLite for DB-backed entitlements
# echo 'DATABASE_URL=file:./dev.db' >> .env
# cd packages/db && pnpm db:push && cd ../..

# Start the API (reads contents/)
cd apps/api && pnpm dev
# → http://localhost:3000/api/v1/health

# Start the viewer
cd apps/viewer && pnpm dev
# → http://localhost:4321

# SSR pages will use API when API_BASE is set:
API_BASE=http://localhost:3000/api/v1 pnpm dev

# Without API_BASE, SSR pages fall back to the shared content loader.
```

### API_BASE Behavior

| `API_BASE` | SSR pages data source | Prerender pages data source |
|------------|----------------------|---------------------------|
| Set (e.g. `http://localhost:3000/api/v1`) | **API fetch** (primary) | content loader (build-time) |
| Not set | content loader fallback | content loader (build-time) |

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/health` | GET | No | Health check |
| `/api/v1/series` | GET | No | List all series |
| `/api/v1/series/:seriesId` | GET | No | Series detail with episodes |
| `/api/v1/series/:seriesId/episodes/:episodeId` | GET | No | Episode metadata + navigation |
| `/api/v1/series/:sid/episodes/:eid/pages/:pn` | GET | Optional | Reader page payload |
| `/api/v1/quotes/:sid/:eid/:pn/:kn/:fn` | GET | No | Quote bubble |
| `/api/v1/clips/:sid/:eid/:pn/:ks/:ke` | GET | No | Clip panel range |
| `/api/v1/reactions?tag=...` | GET | No | Reaction search |

## Viewer File Layout

```
src/
  data/
    content.ts           ← Shared content loader (build-time + fallback)
  lib/
    api-client.ts        ← API fetch client (SSR primary path)
  pages/
    index.astro          ← Prerender (content.ts)
    works/index.astro    ← Prerender (content.ts)
    works/[workId]/      ← Prerender (content.ts)
    works/.../[episodeId].astro  ← SSR (api-client → fallback content.ts)
    quote/[...slug].astro        ← SSR (api-client → fallback content.ts)
    clip/[...slug].astro         ← SSR (api-client → fallback content.ts)
    reaction/[tag].astro         ← SSR (api-client → fallback content.ts)
```

## CMS/Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/series` | POST | Create series |
| `/api/v1/admin/series/:id` | PUT | Update series |
| `/api/v1/admin/series/:id/episodes` | POST | Create episode |
| `/api/v1/admin/series/:id/episodes/:epId` | PUT | Update episode |
| `/api/v1/admin/series/:id/episodes/:epId` | GET | Read full episode for CMS editing |
| `/api/v1/admin/series/:id/publish` | POST | Reload cache |

## Ingestion Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/ingestion/jobs` | POST | Create ingestion job |
| `/api/v1/admin/ingestion/jobs` | GET | List all jobs |
| `/api/v1/admin/ingestion/jobs/:jobId` | GET | Get job detail + draft |
| `/api/v1/admin/ingestion/jobs/:jobId/draft` | PUT | Update draft payload |
| `/api/v1/admin/ingestion/jobs/:jobId/submit` | POST | Submit for review |
| `/api/v1/admin/ingestion/jobs/:jobId/confirm` | POST | Confirm → write to contents/ |
| `/api/v1/admin/ingestion/jobs/:jobId/cancel` | POST | Cancel job |

## Ingestion Flow

```
CMS: Create Job (label + draft payload)
  → API: POST /admin/ingestion/jobs
  → drafts/{jobId}.json (status: draft)

CMS: Edit draft → Save
  → API: PUT /admin/ingestion/jobs/:jobId/draft
  → drafts/{jobId}.json updated

CMS: Submit for Review
  → API: POST /admin/ingestion/jobs/:jobId/submit
  → status: waiting_review

CMS: Review → Confirm
  → API: POST /admin/ingestion/jobs/:jobId/confirm
  → FileContentWriter.createSeries() + saveEpisode()
  → contents/{seriesId}/series.json + {episodeId}/episode.json
  → status: confirmed
  → viewer/API can now read the new content
```

## Auth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/dev-login` | POST | Dev login → sets cookie + returns token |
| `/api/v1/auth/me` | GET | Current user (from Bearer or cookie) |

Admin endpoints require an authenticated admin user. The CMS sends `credentials: "include"` on all `/admin/*` requests so the `manga_auth` cookie is forwarded.
`X-API-Key` is implemented for production admin access, but it is not a replacement for end-user/browser auth.

## Entitlement Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/entitlements/grant` | POST | Grant entitlement to user |
| `/api/v1/admin/entitlements/list` | GET | List entitlements for user |
| `/api/v1/admin/entitlements/revoke` | POST | Revoke entitlement |
| `/api/v1/entitlements/check` | GET | Check if user is entitled |

## Delivery Endpoint

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/deliver/:pageId` | GET | Token-verified image delivery |

## Access Model

- **Episode 1** of any series → free (no auth required)
- **Episode 2+** → requires auth + entitlement
- Series-level entitlement covers all episodes
- Reader returns `gated: true` with no images for locked content
- Delivery URLs use HMAC-signed tokens (5-min TTL)
- Viewer SSR forwards request cookies to the API so entitled users can render protected episodes server-side

## Next Steps

1. **Share API response contracts** — reduce duplicated typing
2. **OAuth/SSO** — add full identity provider for richer user management
3. **Stripe webhooks** — connect purchase flow to external provider
4. **Add OCR / panel detection** — enhance ingestion
5. **Full monitoring** — error reporting, alerts, dashboards
6. **CDN / edge deployment** — optimize delivery

## Verification Notes

- `pnpm install` succeeded
- `pnpm --filter @manga/db db:generate` succeeded
- `pnpm --filter @manga/db db:push` succeeded — all 5 tables created (+ MagicLinkToken = 6)
- `pnpm build` succeeded
- `pnpm --filter @manga/api start` works (no DB and with `DATABASE_URL`)
- `/health` returns `db: "healthy"` in DB mode
- Magic link auth: `POST /auth/login` → DB token → email → `GET /auth/verify` → session cookie
- Magic link tokens are DB-backed, one-time-use, 15-minute TTL
- Production without `RESEND_API_KEY` → `/auth/login` returns 503 (fail closed)
- Rate limiting: `/auth/login` returns 429 on excess requests (email + IP dual key)

## Auth & Session Architecture

### Rate Limiting

| Dimension | Dev | Production |
|-----------|-----|------------|
| Per email | 20 / 60s | 5 / 300s |
| Per IP | 20 / 60s | 5 / 300s |
| Response | 429 RATE_LIMITED | 429 RATE_LIMITED |

In-memory sliding window. Single-instance. For multi-instance, swap to Redis.

> **IP trust boundary:** Client IP is determined by `getClientIp()`, which only reads
> `X-Forwarded-For` when `TRUST_PROXY=1` is set. Without it, all requests report
> IP as `"direct"` and rate limiting relies solely on the email key.
> Set `TRUST_PROXY=1` only when running behind a trusted reverse proxy.

### Session Cookies

```
manga_auth=<HMAC token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400
+ Secure (production only)
```

**Session policy: stateless HMAC.**
- Tokens are signed with `DEV_AUTH_SECRET` — no DB lookup on each request
- No server-side session revocation (requires secret rotation to invalidate all sessions)
- To upgrade to DB-backed sessions, add a `Session` model and check on each request
- Current approach is suitable for single-tenant / low-stakes deployments

### Magic Link Token Lifecycle

1. `POST /auth/login` → creates `MagicLinkToken` (hash stored, 15-min TTL)
2. Email sent via Resend (or console in dev)
3. `GET /auth/verify?token=...` → atomic consume (`updateMany WHERE consumedAt=null AND expiresAt > now`)
4. Session cookie issued
5. `POST /admin/auth/cleanup` → deletes expired + consumed tokens

Cleanup can be called manually or from a cron:
```bash
curl -X POST http://localhost:3100/api/v1/admin/auth/cleanup -b admin-cookies.txt
```

### Audit Fields

| Model | Field | Purpose | Status |
|-------|-------|---------|--------|
| PurchaseRecord | `createdBy` | Admin user ID who created the record | ✅ Saved on create |
| PurchaseRecord | `metadata` | JSON blob for provider-specific data | ✅ Saved on create |
| RedeemCode | `redeemedIp` | IP of the redeemer (abuse tracking) | ✅ Saved on redeem |
| MagicLinkToken | `requestIp` | IP that requested the link | ✅ Saved on create |

## E2E Verification Steps

```bash
# 1. Setup
pnpm install
pnpm --filter @manga/db db:generate
DATABASE_URL="file:./dev.db" pnpm --filter @manga/db db:push
pnpm build

# 2. Start API in DB mode
DATABASE_URL="file:$(pwd)/packages/db/prisma/dev.db" PORT=3100 pnpm --filter @manga/api start &

# 3. Health check
curl http://localhost:3100/api/v1/health
# Expected: {"db":"healthy", ...}

# 4. Dev login (admin)
curl -X POST http://localhost:3100/api/v1/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"userId":"dev-admin","name":"Admin"}' -c cookies.txt

# 5. Create purchase with idempotency key
curl -X POST http://localhost:3100/api/v1/admin/purchases \
  -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"provider":"MANUAL","providerPurchaseId":"test-001","productId":"rain-world-full","codes":[{"targetType":"SERIES","targetId":"rain-world"}]}'
# Note the code from response

# 6. Retry same purchase (idempotency: returns same record)
curl -X POST http://localhost:3100/api/v1/admin/purchases \
  -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"provider":"MANUAL","providerPurchaseId":"test-001","productId":"rain-world-full","codes":[{"targetType":"SERIES","targetId":"rain-world"}]}'
# Should return same purchase ID

# 7. User login via magic link (DB-backed, one-time token)
curl -X POST http://localhost:3100/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"reader@example.com"}'
# Dev mode: response includes token and verifyUrl

# 8. Verify magic link and get session (token is consumed)
curl "http://localhost:3100/api/v1/auth/verify?token=<TOKEN_FROM_STEP_7>" -c user-cookies.txt
# Expected: {"authenticated":true,"user":{...}}

# 9. Re-use same magic link (should fail — one-time use)
curl "http://localhost:3100/api/v1/auth/verify?token=<TOKEN_FROM_STEP_7>"
# Expected: 401 "This login link has already been used"

# 10. Redeem code
curl -X POST http://localhost:3100/api/v1/redeem \
  -b user-cookies.txt -H 'Content-Type: application/json' \
  -d '{"code":"<CODE_FROM_STEP_5>"}'

# 11. Check entitlement (uses seriesId + episodeId)
curl "http://localhost:3100/api/v1/entitlements/check?seriesId=rain-world&episodeId=ep02" \
  -b user-cookies.txt
# Expected: {"entitled":true, ...}

# 12. Access locked episode (should be ungated now)
curl http://localhost:3100/api/v1/series/rain-world/episodes/ep02/pages/1 \
  -b user-cookies.txt
```
