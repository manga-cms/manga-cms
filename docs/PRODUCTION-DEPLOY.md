# Production Domain Deploy Checklist

This checklist prepares the public `manga-cms.com` launch domains for
Cloudflare DNS, Fly.io custom domains, Search Console, indexing, and analytics.

It is an operations checklist. It does not change Viewer routes, API behavior,
CMS behavior, content schemas, or canonical `contents/` data.

## Public Hosts

Use these public hosts for the first production launch:

- `https://manga-cms.com/` is the official site.
- `https://www.manga-cms.com/` redirects permanently to
  `https://manga-cms.com/`.
- `https://read.manga-cms.com/` is the public Reader.
- `https://cms.manga-cms.com/` is the creator CMS. Keep it out of sitemap
  submission and do not treat it as a public reader/indexing surface.

Keep staging, preview, local, API, and CMS hosts out of public sitemap
submission.

## Cloudflare DNS

Before launch:

- [ ] Confirm `manga-cms.com` is managed in Cloudflare DNS.
- [ ] Confirm SSL/TLS mode is `Full (strict)`.
- [ ] Point `manga-cms.com` to the production official-site Fly app using the
  DNS record shape returned by `fly certs show manga-cms.com`.
- [ ] Configure `www.manga-cms.com` as a Cloudflare Redirect Rule or Page Rule
  that returns a permanent redirect to `https://manga-cms.com/$1`.
  This redirect must work before Cloudflare tries to connect to an origin;
  otherwise `www` can fail with SSL 525 if it is proxied without an origin
  certificate.
- [ ] Point `read.manga-cms.com` to the production Reader Fly app using the DNS
  record shape returned by `fly certs show read.manga-cms.com`.
- [ ] Point `cms.manga-cms.com` to the production CMS Fly app using the DNS
  record shape returned by `fly certs show cms.manga-cms.com`.
- [ ] Keep new Fly custom-domain DNS records DNS-only until Fly certificate
  validation is active; enable Cloudflare proxy only after certificate and
  origin behavior are confirmed.
- [ ] If Cloudflare proxy is enabled for a Fly custom domain, add any required
  `_fly-ownership...` TXT records exactly as reported by Fly.

Do not point `manga-cms.com`, `www.manga-cms.com`, or `read.manga-cms.com` at
staging apps.

## Fly Apps And Certificates

Recommended production Fly app split:

- `manga-cms-official-prod` for `manga-cms.com`
- `manga-cms-reader-prod` for `read.manga-cms.com`
- `manga-cms-api-prod` for the Reader's `API_BASE`
- `manga-cms-cms-prod` for `cms.manga-cms.com`

The production Viewer configs are:

- `deploy/fly/viewer-official-production.fly.toml`
- `deploy/fly/viewer-reader-production.fly.toml`

The production CMS config is:

- `deploy/fly/cms-production.fly.toml`

Until `api.manga-cms.com` DNS and certificate are ready, those Viewer configs
use `https://manga-cms-api-prod.fly.dev/api/v1` as `API_BASE` for production
smoke. Switch `API_BASE`, `APP_URL`, and `DELIVERY_PUBLIC_ORIGIN` to
`https://api.manga-cms.com/api/v1` / `https://api.manga-cms.com` during DNS
cutover.

Attach custom domains and wait for certificates:

```bash
fly certs add manga-cms.com --app manga-cms-official-prod
fly certs show manga-cms.com --app manga-cms-official-prod

fly certs add read.manga-cms.com --app manga-cms-reader-prod
fly certs show read.manga-cms.com --app manga-cms-reader-prod

fly certs add cms.manga-cms.com --app manga-cms-cms-prod
fly certs show cms.manga-cms.com --app manga-cms-cms-prod
```

If `www.manga-cms.com` is served by Fly instead of Cloudflare redirect-only,
also add and verify:

```bash
fly certs add www.manga-cms.com --app manga-cms-official-prod
fly certs show www.manga-cms.com --app manga-cms-official-prod
```

If `www.manga-cms.com` is proxied through Cloudflare and Fly reports DNS
mismatch for the `www` certificate, use one of these options before public
launch:

1. Keep `www` redirect-only in Cloudflare and ensure the redirect rule executes
   without contacting the origin.
2. Or point `www.manga-cms.com` at the official Fly app as DNS-only until
   `fly certs show www.manga-cms.com --app manga-cms-official-prod` reports the
   certificate as issued, then decide whether to enable Cloudflare proxy.

Do not leave `www.manga-cms.com` proxied to an origin without a valid `www`
origin certificate.

Before DNS cutover:

- [ ] `fly certs show manga-cms.com` reports the certificate as ready.
- [ ] `fly certs show read.manga-cms.com` reports the certificate as ready.
- [ ] `fly certs show cms.manga-cms.com` reports the certificate as ready.
- [ ] `www.manga-cms.com` either redirects at Cloudflare or has its Fly
  certificate ready.
- [ ] Viewer `SITE_ORIGIN` values match the public host served by each app.
- [ ] Reader `API_BASE` points at the production API origin used for SSR.
- [ ] API `APP_URL`, `DELIVERY_PUBLIC_ORIGIN`, and `ALLOWED_ORIGINS` match the
  production public hosts.

Deploy the production CMS after the production API is reachable:

```bash
fly apps create manga-cms-cms-prod
fly deploy . \
  --config deploy/fly/cms-production.fly.toml \
  --app manga-cms-cms-prod
```

`deploy/fly/cms-production.fly.toml` serves the built React CMS with nginx.
`deploy/fly/cms-production.nginx.conf` proxies same-origin `/api/*` requests to
`https://api.manga-cms.com/api/*`, so the browser uses
`https://cms.manga-cms.com/api/v1/...` while the CMS container talks to the
production API origin. Keep `https://cms.manga-cms.com` in API
`ALLOWED_ORIGINS` for deployments that call the API directly or evolve away
from the same-origin proxy.

CMS production smoke:

- [ ] `https://cms.manga-cms.com/` returns the CMS shell.
- [ ] Direct SPA routes under `https://cms.manga-cms.com/` fall back to
  `index.html`.
- [ ] `https://cms.manga-cms.com/api/v1/health` returns the production API
  health payload through the nginx proxy.
- [ ] Admin login works with the configured production auth path.

## Production API Runtime State

Production runtime state must use Fly Postgres, not the staging SQLite volume.
Canonical manga content still lives under `CONTENTS_DIR` on the API volume until
the R2/manifest publishing path is implemented.

Create and attach Postgres before deploying the production API app:

```bash
fly postgres create --name manga-cms-postgres-prod --region nrt
fly apps create manga-cms-api-prod
fly postgres attach manga-cms-postgres-prod --app manga-cms-api-prod
```

The attach command sets `DATABASE_URL` as a Fly secret. Do not put
`DATABASE_URL` in `deploy/fly/api-production.fly.toml`.

Create the production API volume for canonical content and runtime JSONL files:

```bash
fly volumes create manga_cms_api_prod_data \
  --app manga-cms-api-prod \
  --region nrt \
  --size 3
```

Deploy the production API with the PostgreSQL Prisma provider:

```bash
fly deploy . \
  --config deploy/fly/api-production.fly.toml \
  --app manga-cms-api-prod
```

`deploy/fly/api-production.fly.toml` sets `PRISMA_PROVIDER=postgresql` and the
Docker build uses `packages/db/prisma/schema.postgres.prisma`. Staging keeps
using `PRISMA_PROVIDER=sqlite` and `packages/db/prisma/schema.prisma`.

Production Postgres is being moved from `prisma db push` to Prisma
`migrate deploy` with a baseline-first process. The current `Dockerfile.api`
still runs `db:push:postgres` for production by design. Do not switch that
startup command to `db:migrate:deploy:postgres` until the existing production
database has been backed up, drift-checked, and baselined as described in
`docs/PRODUCTION-POSTGRES-MIGRATIONS.md`.

After deploy:

- [ ] `fly secrets list --app manga-cms-api-prod` shows `DATABASE_URL`.
- [ ] `fly checks list --app manga-cms-api-prod` reports the health check as
  passing.
- [ ] `https://api.manga-cms.com/api/v1/health` returns `ready: true` after
  required production secrets and content are in place.
- [ ] `checks.db` is `healthy`.
- [ ] `/data/contents/oumaga-dokidoki` or the chosen production content exists
  on the production API volume before Reader production smoke.

## Production Env Gates

Set production analytics and indexing env intentionally:

```text
PUBLIC_ANALYTICS_ENV=production
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ENABLED=true
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=<production-cloudflare-web-analytics-token>
PUBLIC_ANALYTICS_ENABLED=false
PUBLIC_GA_MEASUREMENT_ID=<optional-ga4-measurement-id>
PUBLIC_INDEX_EN_LOCALE=false
```

Checklist:

- [ ] Set the production Cloudflare Web Analytics token only on public
  production Viewer deployments.
- [ ] Set the token as a Fly runtime secret or build env before the production
  Viewer deploy. The server-side loader reads runtime env first, so token
  rotation does not require code changes.
- [ ] Confirm the Viewer beacon loads only on `manga-cms.com`,
  `www.manga-cms.com`, and `read.manga-cms.com`.
- [ ] Confirm localhost, staging, preview hosts, `/s/...` Share facade pages,
  and `/og/...` image routes do not emit the Cloudflare Web Analytics beacon.
- [ ] Keep `PUBLIC_ANALYTICS_ENABLED=false` in production so GA4 remains
  disabled.
- [ ] Do not enable GA4 for EU, UK, or Switzerland traffic without Consent
  Mode or a CMP, a consent UI, and updated privacy policy text.
- [ ] Keep `PUBLIC_INDEX_EN_LOCALE=false` or unset for the first launch.
- [ ] Confirm `?lang=en` Reader and Share URLs remain noindexed and excluded
  from sitemap output while `PUBLIC_INDEX_EN_LOCALE` is false or unset.

Cloudflare Web Analytics is the preferred lightweight production traffic check.
GA4 is a later analytics option and should not be treated as a launch blocker.

## Search Console

Use a Google Search Console Domain property:

- [ ] Add a Domain property for `manga-cms.com`.
- [ ] Copy the Google TXT verification value.
- [ ] Add the TXT record in Cloudflare DNS:
  - Type: `TXT`
  - Name: `@` or `manga-cms.com`
  - Content: the exact `google-site-verification=...` value
  - TTL: Auto
- [ ] Wait for DNS propagation, then verify in Search Console.
- [ ] Keep the TXT record after verification so ownership remains stable.

Optional URL-prefix properties can be added later for host-specific debugging:

- `https://manga-cms.com/`
- `https://read.manga-cms.com/`

## Robots And Sitemap

Before submitting sitemaps:

- [ ] Confirm `https://manga-cms.com/robots.txt` returns HTTP 200.
- [ ] Confirm `https://read.manga-cms.com/robots.txt` returns HTTP 200.
- [ ] Confirm `robots.txt` disallows `/og/`.
- [ ] Confirm `robots.txt` references the configured public `SITE_ORIGIN`
  `sitemap.xml` for that deployment.
- [ ] Confirm `https://manga-cms.com/sitemap.xml` returns HTTP 200.
- [ ] Confirm `https://read.manga-cms.com/sitemap.xml` returns HTTP 200.
- [ ] Confirm `/s/...` Share facade URLs are not included in sitemap output.
- [ ] Confirm `/og/...` image routes are not included in sitemap output.
- [ ] Confirm `?lang=en` URLs are not included in the initial sitemap output
  while `PUBLIC_INDEX_EN_LOCALE` is false or unset.

Submit sitemaps in Search Console only after those checks pass:

1. Open the `manga-cms.com` Domain property.
2. Submit `https://manga-cms.com/sitemap.xml`.
3. Submit `https://read.manga-cms.com/sitemap.xml`.
4. Check sitemap fetch status after Google processes each URL.
5. Use URL Inspection for representative official, Reader, Share facade, and
   OGP image URLs when spot-checking indexing behavior.

## Production Smoke URLs

Check these URLs after DNS, Fly certificates, env, robots, and sitemap are in
place:

```text
https://manga-cms.com/
https://manga-cms.com/robots.txt
https://manga-cms.com/sitemap.xml
https://read.manga-cms.com/works/oumaga-dokidoki/episodes/ep01
https://read.manga-cms.com/works/oumaga-dokidoki/episodes/ep01?lang=en
https://read.manga-cms.com/s/oumaga-dokidoki/ep01/p/2
https://read.manga-cms.com/og/oumaga-dokidoki/ep01/p/2.png
```

Expected checks:

- [ ] `https://manga-cms.com/` returns the official site with canonical URLs on
  `https://manga-cms.com`.
- [ ] `https://manga-cms.com/robots.txt` disallows `/og/` and references
  `https://manga-cms.com/sitemap.xml`.
- [ ] `https://manga-cms.com/sitemap.xml` contains only official public URLs.
- [ ] Reader Japanese Episode URL is indexable when the content is approved for
  public search.
- [ ] Reader English `?lang=en` URL is `noindex,follow` while
  `PUBLIC_INDEX_EN_LOCALE=false` or unset.
- [ ] Share facade URL opens or redirects to the Reader but is not present in
  sitemap output.
- [ ] OGP image URL returns an image response but is disallowed by robots and
  not present in sitemap output.
- [ ] Cloudflare Web Analytics is either not loaded or loads only on intended
  production public hosts.
- [ ] GA4 does not load while `PUBLIC_ANALYTICS_ENABLED=false`.
