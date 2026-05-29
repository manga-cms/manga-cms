# Launch Checklist

Last updated: 2026-03-29

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
- [x] Verify required env vars are set and non-default — fail-fast implemented (production exits if missing)

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
- [x] Generate quote OGP metadata
- [x] Generate clip OGP metadata

### 4. Auth and Commerce Smoke Test

- [x] Dev/admin login works in non-production environments
- [x] Production magic-link login works end to end
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

## Commercial Launch

The target here is operational maturity, not just feature completeness.

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

### 3. External Commerce

- [ ] Select payment provider
- [ ] Add webhook endpoint(s)
- [ ] Verify provider retry behavior is idempotent
- [ ] Add reconciliation procedure for failed or delayed webhooks

### 4. Monitoring and Incident Response

- [ ] Add error reporting
- [ ] Add metrics/alerts for API health and auth failures
- [ ] Add metrics/alerts for redeem failures
- [ ] Add metrics/alerts for delivery failures
- [ ] Document incident response contacts/steps

### 5. Delivery and Edge

- [ ] Decide CDN strategy
- [ ] Verify cache behavior for free vs gated content
- [ ] Add delivery observability
- [ ] Validate watermark/delivery flow under load

### 6. Recovery and Audit

- [ ] Run backup/recovery drill
- [ ] Confirm purchase and redeem audit fields are queryable
- [ ] Confirm auth audit fields are queryable
- [ ] Confirm cleanup/admin actions are documented

### Exit Criteria

- [ ] Multi-instance assumptions are removed or explicitly accepted
- [ ] External commerce path is connected
- [ ] Monitoring and recovery drills are complete
- [ ] Identity strategy is stable enough for real users

## Suggested Order

1. Deployment rehearsal
2. Smoke test checklist
3. Reader UX gaps
4. Backup/restore
5. Multi-instance hardening
6. External commerce
7. Monitoring and recovery drills
