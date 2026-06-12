# Production Ops Checklist

Last updated: 2026-06-12

This checklist is for public beta operation of a self-hosted Manga CMS site. It
is public and provider-neutral where possible. It does not add commercial
platform features.

## CI And Release Hygiene

- [ ] GitHub Actions CI is green on `main`.
- [ ] CI failures identify the responsible area: install, Prisma generation,
      package build, app build, tests, compose safety, content validation, or
      documentation link checks.
- [ ] Release changes are reproducible from a clean checkout.
- [ ] No secrets, private URLs, or production tokens are committed.
- [ ] Public history does not contain internal-only implementation notes.
- [ ] Public OSS work happens in a clean clone or a dedicated public working
      tree.
- [ ] `git status` and `git remote -v` are checked before public pushes.
- [ ] Private/commercial branches are not mixed into the public repository.
- [ ] If a disposable public working tree must be realigned with `origin/main`,
      stop first when uncommitted changes exist. Do not use
      `git reset --hard origin/main` as a routine default workflow.

## Search And Analytics

- [ ] Search Console Domain property is verified for the public domain.
- [x] Search Console DNS TXT record is present on the public domain.
- [ ] Public sitemaps are submitted only after production smoke passes.
- [x] `/s/...` Share facades and `/og/...` image routes are excluded from
      sitemap output.
- [x] English `?lang=en` URLs remain `noindex` until approved for search.
- [x] Lightweight analytics is confirmed only on production public hosts.
- [x] GA4 remains disabled unless consent and privacy requirements are ready.

## Content Source Backup And Restore

`contents/` and `packs/` are canonical editorial source. Back them up separately
from runtime DB state.

- [ ] Backup `contents/` before and after each publish operation.
- [ ] Backup `packs/` before and after each Pack publish operation.
- [ ] Backup image assets referenced by canonical content together with the
      corresponding `contents/` snapshot.
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
- [ ] Verify any derived indexes, caches, references, or operational state can
      be rebuilt or validated from canonical `contents/` / `packs/` plus the
      runtime DB backup.
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

Provider-neutral manifest/export contracts are OSS-safe. Vendor-specific upload
implementations, cache rules, custom hostname routing, paid gated delivery, and
commercial CDN operations are private/commercial-layer work unless they are
explicitly accepted as optional examples.

- [ ] Define what a publish/export command emits: core JSON, Pack JSON, images,
      OGP images, and manifest pointers.
- [ ] Ensure published artifacts are immutable or revisioned.
- [ ] Keep the manifest as the pointer to the active published revision.
- [ ] Verify manifest rollback behavior in a disposable environment.
- [ ] Do not require a specific object store, custom hostname routing,
      commercial CDN adapters, or paid gated delivery to use the public OSS
      engine.

## Public Beta Exit Criteria

- [ ] CI is green and diagnosable.
- [ ] Search Console and sitemap submission are confirmed.
- [ ] Production analytics is confirmed on public hosts only.
- [ ] Content backup and restore drill passes.
- [ ] Runtime DB backup and restore drill passes.
- [ ] Monitoring and rollback are documented.
- [ ] Public Reader and CMS workflows pass smoke checks after deploy.
