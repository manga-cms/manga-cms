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
  -> Fly.io nrt CMS       React SPA / nginx
  -> Postgres             Prisma runtime state
  -> R2                   published immutable assets, introduced in a later step
```

Do not treat the Cloudflare Workers/R2/D1 reference design as a one-step
replacement for the current Fly deployment. The recommended path is:

1. Run the API, Viewer, and CMS on Fly.io `nrt`.
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
`manga-cms.com`, `www.manga-cms.com`, `read.manga-cms.com`, and
`cms.manga-cms.com` DNS, Fly custom domains and certificates, production
analytics env, Search Console DNS TXT verification, robots/sitemap submission,
and public smoke URLs.

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
| `APP_URL` | Public-facing API URL (e.g. `https://app.example.com/api/v1`) |
| `API_BASE` | Internal API URL for viewer SSR |
| `DELIVERY_PUBLIC_ORIGIN` | Optional public API origin for signed image URLs when different from `API_BASE` |
| `FEEDBACK_DIR` | Private runtime JSONL storage for reader feedback |
| `PROPOSALS_DIR` | Private runtime JSONL storage for Proposal Queue records |
| `PACK_DRAFTS_DIR` | Private runtime JSONL storage for Pack draft records |
| `PACKS_DIR` | Canonical Pack manifest storage, defaults to repository `packs/` |
| `TRUST_PROXY` | `1` if behind reverse proxy (Cloudflare, nginx) |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins (e.g. `https://manga.example.com,http://localhost:4321`) |

**Optional production features:**

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Optional email delivery for magic-link login |
| `EMAIL_FROM` | Optional sender address for magic links |

If `RESEND_API_KEY` is unset in production, the API still starts and magic-link
login returns `EMAIL_NOT_CONFIGURED`. This keeps the self-hosted engine usable
without a required commercial email provider.

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

## Docker Compose

Use Docker Compose for the shortest self-host path from a fresh clone to a
running API, Viewer, CMS, and Postgres stack.

The default compose stack is for local demos only. It binds services to
`127.0.0.1` and uses development secrets; do not expose it directly to the
internet.

```bash
docker compose up --build
```

Default local URLs:

| Service | URL |
|---------|-----|
| API health | `http://localhost:3000/api/v1/health` |
| Viewer | `http://localhost:4321` |
| CMS | `http://localhost:5173` |
| Postgres | `localhost:5432` |

The compose stack starts four services:

- `postgres`: Postgres 16 with a named `postgres-data` volume.
- `api`: Hono API on port `3000`. Its entrypoint creates runtime directories,
  waits for Postgres, then runs `pnpm --filter @manga/db db:push:postgres`
  before starting the API.
- `viewer`: Astro SSR Viewer on port `4321`, with server-side API calls routed
  to `http://api:3000/api/v1`.
- `cms`: built React CMS served by nginx on port `5173`, with `/api/*`
  proxied to the API container.

Runtime state is not baked into images. Compose bind-mounts canonical editorial
source and private runtime state from the host:

| Data | Mount |
|------|-------|
| Manga content | `./contents:/data/contents` |
| Packs | `./packs:/data/packs` |
| Feedback | `./feedback:/data/feedback` |
| Proposals | `./proposals:/data/proposals` |
| Pack drafts | `./pack-drafts:/data/pack-drafts` |
| Ingestion drafts/imports/assets | `./drafts`, `./imports`, `./draft-assets` |
| Rights, entitlements, GitHub handoff state | `./rights`, `./entitlements`, `./github-handoffs`, `./github-identities` |
| Postgres state | `postgres-data:/var/lib/postgresql/data` |

To stop containers while keeping data:

```bash
docker compose down
docker compose up
```

Do not pass `-v` to `docker compose down` unless you intentionally want to
delete the Postgres volume. Host-mounted runtime directories such as
`contents/`, `packs/`, and `feedback/` remain on disk either way.

Quick validation:

```bash
curl http://localhost:3000/api/v1/health
# Expected: JSON with "status": "ok"

curl -I http://localhost:4321/
curl -I http://localhost:5173/
```

The default compose environment is development-oriented and uses local secrets
that are safe only for local demos. Before using the compose stack for
production, keep it behind a reverse proxy or override the port bindings, and
override at least these values in an environment-specific compose file or shell
environment:

| Variable | Production requirement |
|----------|------------------------|
| `NODE_ENV` | Set API to `production` after all required env is configured |
| `DATABASE_URL` | Use a production Postgres URL with durable backups |
| `DEV_AUTH_SECRET` | Set a unique random value of at least 32 characters |
| `DELIVERY_SECRET` | Set a unique random value of at least 32 characters |
| `APP_URL` | Public API base URL, e.g. `https://api.example.com/api/v1` |
| `API_BASE` | Internal Viewer-to-API URL, or public API URL when not on one Docker network |
| `DELIVERY_PUBLIC_ORIGIN` | Public origin used for signed delivery image URLs |
| `ALLOWED_ORIGINS` | Public Viewer and CMS origins |
| `TRUST_PROXY` | `1` when behind a trusted reverse proxy |
| `CONTENTS_DIR`, `PACKS_DIR`, runtime `*_DIR` values | Durable host paths or volumes for editorial and private runtime data |

### Optional Demo Profile

If `contents/` is empty and you want a quick local smoke target before a
rights-cleared sample manga is available, start Compose with the optional demo
profile:

```bash
READER_TEXT_VIEW_SERIES=synthetic-demo docker compose --profile demo up --build
```

The profile runs a one-shot `demo-seed` service that writes a clearly labeled
`synthetic-demo` placeholder series into `contents/`. The seed exits without
changes when `contents/` already contains any non-`.gitkeep` entry, so it does
not overwrite real editorial content. This placeholder is for local smoke
testing only and should be replaced by a rights-cleared sample manga before
public demos or screenshots.

Optional production email login also needs `RESEND_API_KEY` and `EMAIL_FROM`.
Keep commercial CDN, object storage, and provider-specific deployment choices
outside this compose baseline.

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
#   "checks": { "db": "healthy", "email": "configured|disabled", "secrets": { "auth": "set", "delivery": "set" }, "contents": "loaded" },
#   "ready": true
# }
# ready=false if any check fails
```

> **Note:** In production, the API will refuse to start if required env vars are missing
> (`DEV_AUTH_SECRET`, `DELIVERY_SECRET`, `DATABASE_URL`, `APP_URL`).

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

For the `manga-cms.com` production deployment, the repo also includes a Fly
config for the creator CMS:

```bash
fly apps create manga-cms-cms-prod
fly deploy . \
  --config deploy/fly/cms-production.fly.toml \
  --app manga-cms-cms-prod
```

This deployment serves the CMS at `https://cms.manga-cms.com/` and proxies
same-origin `/api/*` requests to `https://api.manga-cms.com/api/*` through
nginx. It is a static CMS deployment only; canonical manga content still lives
under the API's `CONTENTS_DIR`, and runtime state still belongs to the API /
Postgres side.

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
| Magic link login returns 503 | Set `RESEND_API_KEY`, or keep email login disabled and use another admin access path |
| 401 on admin routes | Verify `DEV_AUTH_SECRET` matches between sessions |
| Viewer shows "API not configured" | Set `API_BASE` for the viewer process |
| CORS errors in browser | Set `ALLOWED_ORIGINS` to include your frontend URLs |
| JSON `{"error":{"code":"NOT_FOUND"}}` | Route does not exist — check API path |
