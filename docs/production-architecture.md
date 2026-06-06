# Production Architecture Direction

Last updated: 2026-06-05

This document adapts the Cloudflare-first architecture proposal to the current
`manga-cms` repository. It is a migration direction, not an instruction to
replace the current Fly/API/Viewer architecture in one step.

## Current Baseline

The current deployable architecture is:

```text
Cloudflare DNS / SSL
  -> Fly.io nrt API        Hono / Node
  -> Fly.io nrt Viewer     Astro SSR / Node
  -> local or Fly volume   contents, packs, feedback, drafts
  -> Prisma SQLite         runtime state in staging/dev
  -> Fly Postgres path     production runtime state bootstrap
```

The current repository contract remains:

- `contents/` is the canonical manga content store.
- `packs/` contains canonical Pack manifests.
- `packages/domain` and `packages/schemas` are the shared contract packages.
- `packages/db` owns runtime state such as entitlements, auth, purchases,
  redeem codes, ingestion jobs, and future production feedback state.
- Public HTTP APIs remain under `/api/v1/*`.
- `packages/db/prisma/schema.prisma` is the SQLite dev/staging schema.
- `packages/db/prisma/schema.postgres.prisma` is the matching production
  schema for Fly Postgres runtime state until the Prisma schema source of truth
  is consolidated.

### Current Image Delivery Path

Current staging/beta image reads are dynamic API delivery:

```text
Viewer SSR / browser
  -> `/api/v1/deliver/{pageId}?token=...`
  -> Fly.io API validates the delivery token
  -> Fly volume / local `contents/` episode asset path
  -> image response with containment checks
```

This is acceptable for beta because it keeps entitlement checks, unpublished
content, and protected filesystem paths behind the API. Raw filesystem paths
must not be exposed to Reader clients. The API should continue to derive image
responses from canonical `contents/` only through the existing delivery-token
and containment logic.

The Viewer has been adjusted to reduce the impact of speculative preload /
prefetch failures, so a failed ahead-of-time image request should not break the
main reading flow. That is a resilience improvement, not the long-term
delivery architecture. The root fix for production scale is moving published
free image assets to immutable public artifacts with CDN caching.

Before public traffic spikes, commercial launch, or many image-heavy episodes,
published page images should move to:

```text
contents/ editorial source
  -> publish/export step
  -> R2 revisioned objects
  -> immutable manifest.json pointers
  -> Cloudflare CDN/cache
  -> Viewer prefers published asset URLs for public free content
```

The API delivery route should remain available for gated content, admin preview,
local development, and fallback while the published-asset path rolls out.
R2/CDN URLs should be revisioned or content-hashed so the same public URL does
not change image bytes after SNS/browser caches have seen it.

## Target Production Shape

The recommended first production architecture is a hybrid:

```text
Cloudflare
  DNS / SSL / CDN / WAF / Turnstile / Access

Fly.io nrt
  API     Hono / Node
  Viewer  Astro SSR / Node

Supabase Postgres Tokyo or equivalent Postgres
  runtime state through Prisma

Cloudflare R2 + Cloudflare cache
  published immutable images
  published core JSON
  published Pack JSON
  manifest.json pointers

contents/ and packs/
  canonical editorial source until an explicit storage migration
```

This keeps the current implementation moving while adopting the strongest part
of the Cloudflare-first proposal: cheap, cacheable, burst-tolerant public
delivery for published manga assets.

## Architecture Principles

### Reader Reads Should Become Static Where Possible

The public Reader should eventually load:

```text
manifest.json
  -> revisioned page images
  -> revisioned core JSON
  -> revisioned Pack JSON
```

The dynamic API may still exist for auth, entitlement checks, CMS editing,
feedback submission, admin review, and commerce. Published free content should
not require an application-server transaction for every image read.

### Published Assets Are Immutable

Published R2 objects should use revisioned keys:

```text
series/{seriesId}/episodes/{episodeId}/manifest.json
series/{seriesId}/episodes/{episodeId}/core/rev-000001.json
series/{seriesId}/episodes/{episodeId}/packs/{locale}/rev-000001.json
series/{seriesId}/episodes/{episodeId}/pages/{pageId}/rev-000001.webp
series/{seriesId}/episodes/{episodeId}/ogp/pages/{pageId}/rev-000001.png
series/{seriesId}/episodes/{episodeId}/ogp/panels/{panelId}/rev-000001.png
```

Only `manifest.json` is mutable. Revisions are append-only. Rollback means
moving the manifest pointer and recording an audit event.

### OGP Artifacts Are Published Assets

Page and Panel OGP images should become published artifacts alongside page
images. They are not just dynamic image-generation responses: they are
public-safe preview assets that SNS crawlers cache aggressively.

The publish/export step should eventually write OGP artifact metadata into the
Episode `manifest.json`:

```text
ogp:
  page[pageId]:
    url, width, height, mimeType, revision, sourcePageImageRevision
  panel[panelId]:
    url, width, height, mimeType, revision, sourcePageImageRevision, bboxHash
```

MVP dynamic generation can use the API and the same delivery containment logic
while traffic is low. Before commercial launch or high sharing volume, Panel
OGP should be generated during publish/export and stored in R2 with immutable
revisioned URLs. The default MIME type should be `image/png` to preserve manga
line art and text. JPEG, WebP, AVIF, or PNG reduction are optimization layers
only after visual quality and crawler compatibility are verified.

The first OGP implementation should be Page OGP only. While R2/manifest OGP
metadata is not available, Share URL SSR may point `og:image` at the existing
`/api/v1/og/page/{pageId}` facade for public-safe Page or Episode targets. This
is a beta bridge, not the final published artifact model. It must never expose
raw `contents/` paths or short-lived delivery-token URLs in HTML, and it should
fall back to text-only metadata when the Page target is gated, hidden, expired,
rights-uncleared, or otherwise not public-safe.

The MVP OGP canvas should be 1200 x 630 px, rendered as PNG by default, with
contain-fit source imagery and deterministic neutral padding. Manga line art and
text readability take priority over aggressive file-size optimization. JPEG,
WebP, AVIF, and PNG reduction can be introduced only after visual QA and crawler
compatibility checks.

Share URL SSR should resolve OGP revisions from the published manifest first.
If a target-specific Panel artifact is missing or invalid, SSR should fall
back to Page, Episode, Series, then default OGP metadata instead of emitting a
mutable best-effort Panel URL. A published artifact URL must not change bytes;
style, crop, source image, or policy changes require a new revision/hash.

The published manifest is the source of truth for revision ids, content hashes,
immutable OGP artifact URLs, and cache keys. These values are generated by the
publish/export pipeline; they are not CMS-editable metadata.

### R2 Is A Published Artifact Store First

R2 is not the canonical content store for this repository yet. It is the
published artifact store generated from canonical `contents/` and `packs/`.

Moving canonical editorial content from `contents/` into R2, D1, Postgres, or
another store is a separate migration task and must update the API contract,
domain interfaces, schemas, CMS workflow, backup policy, and import/export
tooling together.

### D1 And Workers Are Optional Future Adapters

The Cloudflare-first proposal is still valuable, but its D1/Workers pieces
should be treated as future adapters:

```text
ObjectStore      -> R2 now, S3/MinIO later if needed
RuntimeState     -> Postgres first, D1 only for a Cloudflare-native deployment
JobQueue         -> no queue first, then Redis/BullMQ, SQS, Cloudflare Queues, etc.
API runtime      -> Hono on Node/Fly first, Workers adapter later if justified
```

Core packages must not import Cloudflare runtime types.

## Cost And Speed Expectations

Approximate monthly ranges for early operation:

| Shape | Cost tendency | Speed / ops notes |
|-------|---------------|-------------------|
| Current Fly staging | Very low | Good for rehearsal, not multi-instance production |
| Fly + Postgres | Low to moderate | Best first paid-production baseline |
| Fly + Postgres + R2 | Low to moderate | Recommended first public/commercial architecture |
| Full Cloudflare Workers/R2/D1 | Potentially lowest | Higher migration cost from current code |

R2 can keep public image delivery close to free at small scale because it has a
free storage tier and no internet egress charge. It still charges for storage
above the free tier and operations. Workers/D1 may also stay in free tiers for
small traffic, but the engineering cost of a full runtime migration is higher
than adding R2 as a published delivery layer.

For Japan-focused readers, Fly `nrt` is already a good API/SSR location. R2 plus
Cloudflare cache mainly improves image and JSON asset burst tolerance.

## Migration Timing

Use these gates:

1. Public beta rehearsal can stay on Fly + SQLite volume if it is free-only,
   small, and explicitly staging-grade.
2. Before real paid sales, move runtime state from SQLite to Postgres.
3. Before expecting reader traffic spikes or publishing many images, add R2
   published assets and manifest-based delivery.
4. Before multi-instance API operation, move feedback/proposals/pack drafts and
   rate limiting out of file-backed or memory-only storage.
5. Consider Workers/D1 only after the manifest/R2 model is proven and the cost
   or operational benefit justifies a runtime adapter migration.

## Implementation Order

1. Keep the current `/api/v1/*` contract and Fly deployment.
2. Add a Postgres production path for Prisma runtime state.
3. Add a `PublishedAssetStore` or equivalent object-store interface in the
   existing domain boundary.
4. Add an R2 adapter outside the core domain packages.
5. Add a publish/export command that emits revisioned page images, core JSON,
   Pack JSON, and `manifest.json` from `contents/` and `packs/`.
6. Update Viewer read paths to prefer manifest/R2 assets for public free
   content while preserving current API behavior for gated/admin flows.
7. Add cache headers and Cloudflare Cache Rules for JSON and image assets.
8. Move feedback and proposal runtime state to the production DB before
   multi-host operation.
9. Re-evaluate whether Workers/D1 are worth implementing as a second deployment
   adapter.

## Not In The First Migration

- Do not rename Series / Episode / Page / Panel / Bubble.
- Do not replace `packages/domain` or `packages/schemas` with new parallel
  packages.
- Do not move canonical content out of `contents/` without a dedicated
  migration.
- Do not change `/api/v1/*` route shapes only to match a Cloudflare reference.
- Do not make unauthenticated Reader feedback mutate published content.
- Do not process large ZIP uploads synchronously inside a request handler.
