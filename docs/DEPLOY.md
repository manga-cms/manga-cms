# Production Deploy Guide

This document covers how to deploy Manga CMS in production mode.

## Prerequisites

- Node.js ≥20
- pnpm 9.x
- Database: SQLite (dev) or PostgreSQL (production)

## Recommended Production Architecture

The first production architecture should stay close to the current repository:

```text
Cloudflare DNS / SSL / CDN / Access / Turnstile
  -> Fly.io nrt API       Hono / Node
  -> Fly.io nrt Viewer    Astro SSR / Node
  -> Postgres             Prisma runtime state
  -> R2                   published immutable assets, introduced in a later step
```

Do not treat the Cloudflare Workers/R2/D1 reference design as a one-step
replacement for the current Fly deployment. The recommended path is:

1. Run the API and Viewer on Fly.io `nrt`.
2. Use Postgres for production runtime state before real paid sales.
3. Keep `contents/` and `packs/` as canonical editorial source.
4. Add R2/manifest delivery for published images and JSON before traffic-heavy
   launch.
5. Revisit Workers/D1 only as optional future adapters.

See `docs/production-architecture.md` for the migration sequence.

For public launch indexing and analytics operations, use
[`analytics-and-search-console.md`](analytics-and-search-console.md). That
document covers Search Console Domain property verification, sitemap inclusion,
English `noindex`, canonical / `hreflang`, Cloudflare Web Analytics
implementation boundaries, and GA4 enablement boundaries.

For production public-domain cutover, use
[`PRODUCTION-DEPLOY.md`](PRODUCTION-DEPLOY.md). That checklist covers
`manga-cms.com`, `www.manga-cms.com`, and `read.manga-cms.com` DNS, Fly custom
domains and certificates, production analytics env, Search Console DNS TXT
verification, robots/sitemap submission, and public smoke URLs.

## Environment Variables

Copy `.env.example` to `.env` and set all required values:

```bash
cp .env.example .env
```

**Must be set in production:**

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Prisma connection string |
| `DEV_AUTH_SECRET` | HMAC secret for session tokens (≥32 chars) |
| `DELIVERY_SECRET` | HMAC secret for delivery tokens (≥32 chars) |
| `RESEND_API_KEY` | Email delivery for magic-link login |
| `EMAIL_FROM` | Sender address for magic links |
| `APP_URL` | Public-facing API URL (e.g. `https://app.example.com/api/v1`) |
| `API_BASE` | Internal API URL for viewer SSR |
| `DELIVERY_PUBLIC_ORIGIN` | Optional public API origin for signed image URLs when different from `API_BASE` |
| `FEEDBACK_DIR` | Private runtime JSONL storage for reader feedback |
| `PROPOSALS_DIR` | Private runtime JSONL storage for Proposal Queue records |
| `PACK_DRAFTS_DIR` | Private runtime JSONL storage for Pack draft records |
| `PACKS_DIR` | Canonical Pack manifest storage, defaults to repository `packs/` |
| `TRUST_PROXY` | `1` if behind reverse proxy (Cloudflare, nginx) |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins (e.g. `https://manga.example.com,http://localhost:4321`) |

**Public Viewer launch env gates:**

| Variable | Initial production value | Purpose |
|----------|--------------------------|---------|
| `PUBLIC_ANALYTICS_ENV` | `production` on public production Viewer builds | Production-only analytics gate |
| `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ENABLED` | `true` only on public production Viewer builds | Enables the Cloudflare Web Analytics beacon after host checks |
| `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` | Production Cloudflare Web Analytics site token | Cloudflare Web Analytics site token |
| `PUBLIC_ANALYTICS_ENABLED` | `false` | Keeps GA4 disabled in production |
| `PUBLIC_GA_MEASUREMENT_ID` | optional | GA4 Measurement ID, not active while GA4 is disabled |
| `PUBLIC_INDEX_EN_LOCALE` | `false` or unset | Keeps English `?lang=en` URLs noindexed and sitemap-excluded |

Do not enable GA4 in production without Consent Mode or a CMP, a consent UI,
and updated privacy policy text for the launch regions.

The Viewer only emits the Cloudflare Web Analytics beacon when the request host
is one of `manga-cms.com`, `www.manga-cms.com`, or `read.manga-cms.com`.
Localhost, staging, preview hosts, `/s/...` Share facade pages, and `/og/...`
image routes must not emit the beacon.

## Build

```bash
# 1. Install dependencies
pnpm install

# 2. Generate the default SQLite Prisma client for local/dev/staging
pnpm --filter @manga/db db:generate

# 3. Sync the local/dev/staging database schema (creates tables if needed)
DATABASE_URL="<your-db-url>" pnpm --filter @manga/db db:push

# 4. Build all packages
pnpm build
```

For production Fly Postgres builds, generate the PostgreSQL Prisma client:

```bash
pnpm --filter @manga/db db:generate:postgres
```

`packages/db/prisma/schema.prisma` remains the SQLite schema used by local
development and the current staging volume. `packages/db/prisma/schema.postgres.prisma`
is the matching production schema for Fly Postgres runtime state. Keep the model
sets in sync until the Prisma schema source of truth is consolidated.

Production Postgres migrations live separately under
`packages/db/prisma/postgres/migrations/`. Existing production databases that
were initialized with `db:push:postgres` must follow the baseline procedure in
`docs/PRODUCTION-POSTGRES-MIGRATIONS.md` before production startup is changed
to `db:migrate:deploy:postgres`.

## Start Services

### API Server

```bash
NODE_ENV=production \
DATABASE_URL="<your-db-url>" \
DEV_AUTH_SECRET="<secret>" \
DELIVERY_SECRET="<secret>" \
PORT=3000 \
pnpm --filter @manga/api start
```

Verify:
```bash
curl http://localhost:3000/api/v1/health
# Expected:
# {
#   "status": "ok", "env": "production", "seriesCount": 2,
#   "checks": { "db": "healthy", "email": "configured", "secrets": { "auth": "set", "delivery": "set" }, "contents": "loaded" },
#   "ready": true
# }
# ready=false if any check fails
```

> **Note:** In production, the API will refuse to start if required env vars are missing
> (`DEV_AUTH_SECRET`, `DELIVERY_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`).

### Viewer (SSR)

```bash
NODE_ENV=production \
API_BASE="http://localhost:3000/api/v1" \
HOST=0.0.0.0 \
PORT=4321 \
node apps/viewer/dist/server/entry.mjs
```

### CMS

The CMS is a static SPA. Serve the built files:
```bash
npx serve apps/cms/dist -l 5173
```

Or deploy to any static hosting (Cloudflare Pages, Vercel, Netlify).

For local CMS development, `apps/cms/vite.config.ts` proxies `/api` to
`http://localhost:3000` by default. Override it when the API is on another port:

```bash
API_PROXY_TARGET=http://localhost:3100 pnpm --filter @manga/cms dev
```

## Quick Validation

After starting all services:

```bash
# Health
curl http://localhost:3000/api/v1/health

# Works list
curl http://localhost:3000/api/v1/series

# Viewer home
curl -s http://localhost:4321/ | head -5
```

## Reverse Proxy Setup

If running behind nginx or Cloudflare:

1. Set `TRUST_PROXY=1` for the API process
2. Proxy `/api/v1/*` to the API server
3. Proxy everything else to the viewer
4. Serve CMS on a separate subdomain or `/admin/`

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `db: "unavailable"` in health | Check `DATABASE_URL` |
| `ready: false` in health | Ensure `DEV_AUTH_SECRET` and `DELIVERY_SECRET` are set, DB is healthy |
| Magic link login returns 503 | Set `RESEND_API_KEY` |
| 401 on admin routes | Verify `DEV_AUTH_SECRET` matches between sessions |
| Viewer shows "API not configured" | Set `API_BASE` for the viewer process |
| CORS errors in browser | Set `ALLOWED_ORIGINS` to include your frontend URLs |
| JSON `{"error":{"code":"NOT_FOUND"}}` | Route does not exist — check API path |
