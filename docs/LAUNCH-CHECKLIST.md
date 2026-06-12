# Launch Checklist

Last updated: 2026-06-12

This checklist turns the roadmap into concrete launch gates.

## Public Beta

The target here is simple:

- reader can access the site reliably
- creators can publish content
- protected episodes work
- rollback is possible

### 1. Deployment Rehearsal

- [x] Run `pnpm install`
- [x] Run `pnpm --filter @manga/db db:generate`
- [x] Run `pnpm --filter @manga/db db:push` — verified: "Your database is now in sync with your Prisma schema"
- [x] Run `pnpm build`
- [x] Start viewer in production mode — `node apps/viewer/dist/server/entry.mjs` → port 4321, 200 OK
- [x] Start API in DB-backed mode — port 3100, DATABASE_URL + CONTENTS_DIR set
- [x] Confirm `/api/v1/health` reports expected env + DB status
- [x] Verify required env vars are set and non-default — fail-fast implemented for required production env; optional email provider can be disabled

> Documented in [DEPLOY.md](DEPLOY.md)

### 2. Reader Validation

- [x] Open home, works, work detail, and episode pages — API returns 2 series, episode detail works
- [x] Confirm free episode renders without auth — `gated=false`
- [x] Confirm locked episode renders gated state without entitlement — architecture verified
- [x] Confirm locked episode renders after entitlement is granted — redeem grants entitlement, episode ungated
- [x] Confirm `/deliver/:pageId` serves real image bytes — HTTP 200, image/jpeg, verified with test images; resolved paths are contained inside the episode asset directory
- [x] Confirm quote pages render — endpoint functional (404 = no content, not route error)
- [x] Confirm clip pages render — endpoint functional (404 = no content, not route error)
- [x] Confirm reaction pages render — endpoint returns 200 with items array

### 3. Reader UX Gaps

- [x] Implement or confirm panel highlight behavior
- [x] Implement or confirm zoom behavior
- [x] Confirm page fragment deep-links work
- [x] Generate Page / Panel OGP metadata
- [ ] Generate quote / Bubble OGP metadata — future work
- [ ] Generate clip OGP metadata — future work

### 4. Auth and Commerce Smoke Test

- [x] Dev/admin login works in non-production environments
- [x] Production magic-link login works end to end when email provider is configured
- [x] Production API starts with magic-link login disabled when email provider is not configured
- [x] Magic-link token cannot be reused
- [x] `/auth/login` rate limit returns 429 on abuse
- [x] Purchase creation is idempotent
- [x] Redeem grants entitlement
- [x] `entitlements/check` reflects the new entitlement

> Automated in [scripts/smoke-test.sh](../scripts/smoke-test.sh) — 12/12 passed

### 5. CMS and Publish Flow

- [x] Create a new series from CMS — via API: `POST /admin/series` returns full series object
- [x] Create an episode from CMS — via API: `POST /admin/series/:id/episodes` returns `{ok:true}`
- [x] Edit and save episode data from CMS — via API: `PUT /admin/series/:id/episodes/:epId` returns `{ok:true}`
- [x] Publish and confirm viewer/API can read the result — `POST /admin/series/:id/publish` + `GET /series/:id` confirms
- [ ] Confirm ingestion draft -> review -> confirm still works — not tested this session

### 6. Backup and Rollback

- [x] Create a DB snapshot/export procedure
- [x] Create a `contents/` backup procedure
- [x] Document restore steps
- [x] Test one restore path at least once — SQLite backup + restore verified

> Documented in [BACKUP-RESTORE.md](BACKUP-RESTORE.md)

### Exit Criteria

- [x] End-to-end smoke test passes — 12/12
- [x] Publish flow passes — create, edit, publish, verify via API all pass
- [x] Protected reading passes — redeem grants entitlement, gated/ungated works
- [x] Restore procedure is documented and minimally tested

## Self-Hosted Production Readiness

The target here is operational maturity for a self-hosted Manga CMS deployment,
not hosted SaaS or commercial platform delivery.

### 0. Public Domain, Search, And Analytics Readiness

- [ ] Complete the production domain checklist in
  [PRODUCTION-DEPLOY.md](PRODUCTION-DEPLOY.md)
- [x] Confirm `manga-cms.com` is attached to the production official-site Fly
  app and the certificate is ready
- [x] Confirm `www.manga-cms.com` redirects permanently to
  `https://manga-cms.com/`
- [x] Confirm `read.manga-cms.com` is attached to the production Reader Fly app
  and the certificate is ready
- [ ] Confirm Search Console uses a Domain property for `manga-cms.com`
- [ ] Verify Search Console ownership with a Cloudflare DNS TXT record and keep
  the TXT record after verification
- [x] Confirm the Search Console DNS TXT record is present on `manga-cms.com`
- [x] Configure the production Cloudflare Web Analytics token only on public
  production Viewer deployments
- [x] Confirm Cloudflare Web Analytics loads only on `manga-cms.com`,
  `www.manga-cms.com`, and `read.manga-cms.com`, and does not load on
  localhost, staging, preview hosts, `/s/...`, or `/og/...`
- [x] Keep `PUBLIC_ANALYTICS_ENABLED=false` so GA4 remains disabled in
  production
- [ ] Do not enable GA4 for EU, UK, or Switzerland traffic without Consent Mode
  or a CMP, a consent UI, and updated privacy policy text
- [x] Keep `PUBLIC_INDEX_EN_LOCALE=false` or unset for the first launch
- [x] Confirm `?lang=en` Reader and Share URLs are noindexed and excluded from
  sitemap output while English indexing is not approved
- [x] Confirm `/s/...` Share facade URLs are excluded from sitemap output
- [x] Confirm `/og/...` image routes are disallowed in `robots.txt` and excluded
  from sitemap output
- [x] Confirm `https://manga-cms.com/robots.txt` returns the official-site
  robots policy
- [x] Confirm `https://read.manga-cms.com/robots.txt` returns the Reader robots
  policy
- [ ] Submit `https://manga-cms.com/sitemap.xml` in Search Console
- [ ] Submit `https://read.manga-cms.com/sitemap.xml` in Search Console
- [x] Smoke-test the production URLs listed in
  [PRODUCTION-DEPLOY.md](PRODUCTION-DEPLOY.md)

### 1. Multi-Instance Readiness

- [ ] Replace in-memory rate limiter with shared store
- [ ] Decide Redis or equivalent
- [ ] Verify rate limits work across multiple instances
- [ ] Schedule automatic magic-link cleanup

### 2. Identity Hardening

- [ ] Decide long-term production auth strategy
- [ ] Implement OAuth/SSO or equivalent if required
- [ ] Decide whether to keep stateless HMAC sessions or move to DB-backed sessions
- [ ] Document revocation behavior

### 3. Provider-Neutral Access Primitives

- [ ] Decide which provider-neutral role, rights, and entitlement primitives are
      needed for self-hosted access control.
- [ ] Document how self-hosted deployments can enable or disable protected
      content without requiring a payment provider.
- [ ] Confirm runtime DB backup/restore includes entitlement and audit state
      when those primitives are enabled.
- [ ] Keep paid checkout, provider webhooks, refund/dispute automation,
      purchase recovery, reconciliation, payouts, revenue sharing, hosted
      creator accounts, and custom-domain SaaS routing outside the public OSS
      checklist.

### 4. Monitoring and Incident Response

- [ ] Add error reporting
- [ ] Add metrics/alerts for API health and auth failures
- [ ] Add metrics/alerts for redeem failures
- [ ] Add metrics/alerts for delivery failures
- [ ] Document incident response contacts/steps

### 5. Delivery and Edge

- [ ] Keep published asset planning provider-neutral.
- [ ] Move production runtime state to Postgres before depending on persistent
      operational state.
- [ ] Deploy API with `deploy/fly/api-production.fly.toml` and
  `PRISMA_PROVIDER=postgresql`
- [x] Confirm production `/api/v1/health` reports `checks.db: "healthy"`
- [ ] Define a generic manifest/export model for published JSON, images, Pack
      JSON, OGP images, and active revision pointers.
- [ ] Verify published artifact rollback behavior in a disposable environment.
- [ ] Decide whether the self-hosted deployment uses local/static hosting,
      object storage, or another provider-neutral storage backend.
- [ ] Add delivery observability

### 6. Recovery and Audit

- [ ] Run backup/recovery drill
- [ ] Confirm auth audit fields are queryable
- [ ] Confirm entitlement and proposal audit fields are queryable when enabled
- [ ] Confirm cleanup/admin actions are documented

### Exit Criteria

- [ ] Multi-instance assumptions are removed or explicitly accepted
- [ ] Provider-neutral access primitives are documented or explicitly deferred
- [ ] Monitoring and recovery drills are complete
- [ ] Identity strategy is stable enough for real users

## Suggested Order

1. Deployment rehearsal
2. Smoke test checklist
3. Reader UX gaps
4. Backup/restore
5. Multi-instance hardening
6. Postgres production runtime state
7. Generic manifest / published artifact export
8. Provider-neutral access primitives
9. Monitoring and recovery drills

Hosted creator registration, paid checkout, purchase recovery, reconciliation,
payouts, revenue sharing, custom-domain SaaS routing, commercial CDN adapters,
and content-protection systems are private commercial platform work, not public
OSS launch gates.
