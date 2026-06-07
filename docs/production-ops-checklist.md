# Production Ops Checklist

Last updated: 2026-06-07

This checklist is for public beta operation of a self-hosted Manga CMS site. It
is public and provider-neutral where possible. It does not add commercial
platform features.

## CI And Release Hygiene

- [ ] GitHub Actions CI is green on `main`.
- [ ] CI failures identify the responsible area: install, Prisma generation,
      package build, app build, tests, or content validation.
- [ ] Release changes are reproducible from a clean checkout.
- [ ] No secrets, private URLs, or production tokens are committed.
- [ ] Public history does not contain internal-only implementation notes.

## Search And Analytics

- [ ] Search Console Domain property is verified for the public domain.
- [ ] Public sitemaps are submitted only after production smoke passes.
- [ ] `/s/...` Share facades and `/og/...` image routes are excluded from
      sitemap output.
- [ ] English `?lang=en` URLs remain `noindex` until approved for search.
- [ ] Lightweight analytics is confirmed only on production public hosts.
- [ ] GA4 remains disabled unless consent and privacy requirements are ready.

## Content Source Backup And Restore

`contents/` and `packs/` are canonical editorial source. Back them up separately
from runtime DB state.

- [ ] Backup `contents/` before and after each publish operation.
- [ ] Backup `packs/` before and after each Pack publish operation.
- [ ] Store backup timestamp, source revision, and operator notes.
- [ ] Restore `contents/` into a clean environment and verify the API can load
      the restored Series.
- [ ] Restore `packs/` into a clean environment and verify Pack validation.
- [ ] Confirm content restore does not require runtime DB rows to become the
      content source of truth.

## Runtime DB Backup And Restore

Runtime DB stores operational state, not canonical manga content.

- [ ] Backup the production runtime DB.
- [ ] Restore the runtime DB into a disposable environment.
- [ ] Verify Prisma client generation and schema compatibility.
- [ ] Verify health checks after restore.
- [ ] Verify auth/session/API key/entitlement/audit state as applicable.
- [ ] Document the restore command and expected downtime.

## Deploy And Rollback

- [ ] Record the deployed app version or commit SHA.
- [ ] Keep the previous deploy available for rollback.
- [ ] Smoke-test API health, Viewer home, Reader episode, Share URL, OGP image,
      CMS login, and content editing after deploy.
- [ ] Verify rollback steps before public launch.
- [ ] Verify rollback does not overwrite canonical `contents/` or `packs/`.

## Monitoring And Alerts

- [ ] API health check is monitored.
- [ ] Viewer availability is monitored.
- [ ] Image delivery failures are monitored.
- [ ] OGP generation failures are monitored.
- [ ] Feedback/proposal errors are monitored.
- [ ] Content validation errors are surfaced before publish.
- [ ] Alert ownership and escalation steps are documented.

## Published Artifact / Manifest Readiness

Provider-neutral manifest/export contracts are OSS-safe. Vendor-specific
production adapters, cache rules, custom hostname routing, paid gated delivery,
and commercial CDN operations are private/commercial-layer work unless they are
explicitly accepted as optional examples.

- [ ] Define what a publish/export command emits: core JSON, Pack JSON, images,
      OGP images, and manifest pointers.
- [ ] Ensure published artifacts are immutable or revisioned.
- [ ] Keep the manifest as the pointer to the active published revision.
- [ ] Verify manifest rollback behavior in a disposable environment.
- [ ] Do not require Cloudflare R2, custom hostname routing, commercial CDN
      adapters, or paid gated delivery to use the public OSS engine.

## Public Beta Exit Criteria

- [ ] CI is green and diagnosable.
- [ ] Search Console and sitemap submission are confirmed.
- [ ] Production analytics is confirmed on public hosts only.
- [ ] Content backup and restore drill passes.
- [ ] Runtime DB backup and restore drill passes.
- [ ] Monitoring and rollback are documented.
- [ ] Public Reader and CMS workflows pass smoke checks after deploy.
