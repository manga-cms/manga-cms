# Public Share Metadata Roadmap

This document fixes the implementation order for public reader URLs, localized
metadata, and OGP images. It is intentionally contract-first: do not start with
Viewer URL rewrites or dynamic image generation before the content metadata
source of truth is stable.

## Goal

Make shared manga URLs readable, short, crawler-friendly, language-aware, and
public-safe while preserving the current Reader route and canonical content
model:

```text
Series -> Episode -> Page -> Panel -> Bubble
```

The current production Reader may keep using:

```text
/works/{seriesId}/episodes/{episodeId}?lang=en#p3
```

as an internal reading URL. Public SNS share URLs should become separate HTML
facades that can render server-side metadata without relying on URL fragments
or client-side JavaScript.

## Implementation Order

### 1. Content JSON metadata contract

Start here. URL, description, and OGP work all need the same source of truth.

Current canonical content already uses `schemaVersion: 2`. Do not bump to
`schemaVersion: 3` only to add optional metadata. Prefer a v2-compatible
metadata extension first. Use a schemaVersion bump only when a breaking storage
or writer migration is required.

Add or clarify these fields before changing public URLs:

| Area | Needed metadata |
| --- | --- |
| Revision | `revisionId`, published revision, content hash, publish timestamp |
| Locale | canonical locale, available locales, default reader locale |
| SEO | localized Series/Episode title, description, share title, share description |
| Creator display | MVP `authorLabel`, future ordered `creatorCredits` |
| Images | language-specific page image references, cover image, share image alt text |
| Share policy | allowed MVP target kinds: Episode, Page, Panel, Bubble |
| OGP policy | allowed OGP target kinds, crop permission, style preset |
| Public safety | published window, archived/hidden flags, rights cleared for preview |

Rules:

- `Bubble.textOriginal` remains the canonical source text.
- Translations remain in Translation Packs / Pack drafts, not canonical Bubble
  source text.
- Local-only validation content must not become public-safe by accident.
- Existing schemaVersion 2 content must keep loading.
- If future `schemaVersion: 3` is needed, implement a reader/writer migration
  with compatibility tests before changing Viewer behavior.

Exit criteria:

- Domain/Zod schemas describe the metadata.
- Existing content loads without destructive migration.
- CMS can display/edit the metadata needed for public share decisions.
- The metadata can answer: "Is this target allowed to be shared publicly, and
  what title/description/image should crawlers see?"

Step 1 contract shape:

- Series, Episode, Page, Panel, and Bubble may carry optional
  `metadata: ContentPublicMetadata`.
- `metadata` is a v2-compatible extension. Existing `schemaVersion: 2` content
  remains valid when it omits the field.
- The current MVP uses one v2-compatible `ContentPublicMetadata` container so
  existing content can keep loading. Implementations must still treat fields as
  entity-scoped: for example, Bubble metadata should not use Series-level cover
  image or Page image fields. Before expanding the field set further, prefer
  entity-specific shapes such as `SeriesPublicMetadata`,
  `EpisodePublicMetadata`, `PagePublicMetadata`, `PanelPublicMetadata`, and
  `BubblePublicMetadata`.
- `metadata.revisionId`, `metadata.publishedRevisionId`,
  `metadata.contentHash`, and `metadata.publishedAt` are publish-generated
  hints, not normal CMS-editable fields. Existing Episode `revisionId` remains
  valid editorial revision metadata.
- `metadata.canonicalLocale`, `metadata.availableLocales`, and
  `metadata.defaultReaderLocale` define locale availability for share metadata;
  translations still come from Translation Packs or Pack Drafts.
- `metadata.authorLabel` can provide the MVP creator display string for public
  cards and share metadata. Future `metadata.creatorCredits[]` can represent
  ordered role/display entries without replacing the simple label.
- `metadata.localized[locale]` can provide localized `title`, `description`,
  `shareTitle`, `shareDescription`, and `authorLabel`.
- `metadata.pageImages[locale]`, `metadata.coverImage`,
  `metadata.shareImage`, and `metadata.shareImageAlt` provide crawler-facing
  image references and alt text. Canonical Page image references remain
  `Page.images`.
- `Page.images` is locale-keyed canonical content. `ja` is canonical source
  image selection, `en` may provide a localized page image, and Reader/OGP
  selection should prefer requested locale, then default/canonical locale, then
  `ja`, then first available image.
- `metadata.sharePolicy.allowedTargets` uses `episode`, `page`, `panel`,
  and `bubble` for MVP. `clip` is reserved for future multi-Panel share work.
- `metadata.ogpPolicy.allowedTargets` uses `page`, `panel`, and `bubble` for
  MVP, with optional `allowCrop` and `stylePreset`. `clip` is future work.
- `metadata.publicSafety.rightsClearedForPreview`, `hidden`, and `archived`
  are additional public-safety hints layered on top of existing publish
  windows, `visibility`, entity `status`, and `flags`. Deletion remains an
  entity lifecycle state (`status: "deleted"`), not a public metadata flag.

No `schemaVersion: 3` migration is needed for Step 1. A future v3 is justified
only if these metadata fields become required, if existing field semantics
change, or if canonical content storage leaves the current JSON structure.

Metadata vs publish artifact boundary:

- Editable content metadata may define localized titles, descriptions, share
  policy, OGP policy, image references, and public-safety hints.
- Published revision ids, content hashes, immutable OGP artifact URLs, cache
  keys, and final crawler image dimensions are generated by the publish
  pipeline or manifest layer.
- CMS UI must not ask editors to hand-maintain cache keys or immutable artifact
  URLs. It may display generated values read-only when useful.

### 2. Public URL design

Do this after metadata is available. The URL should encode reader intent without
leaking internal storage paths, delivery tokens, or draft IDs.

Keep the current Reader URL as the reading route:

```text
/works/{seriesId}/episodes/{episodeId}
```

Language handling:

- Short-term: keep `?lang=en` for non-canonical language reading.
- Future path option: `/en/works/{seriesId}/episodes/{episodeId}` only after
  SSR metadata, sitemap, and `hreflang` are ready.

Public share URLs should be separate SSR HTML facades:

```text
/s/{seriesId}/{episodeId}
/s/{seriesId}/{episodeId}/p/{pageNumber}
/s/{seriesId}/{episodeId}/p/{pageNumber}/k/{panelRef}
/s/{seriesId}/{episodeId}/p/{pageNumber}/f/{bubbleRef}
```

Step 2 canonical decisions:

- `seriesId` is the public Series slug/stable id used by current Reader routes
  such as `oumaga-dokidoki`. It must not be a database-only UUID unless that
  UUID is already the public route id.
- `episodeId` is the public Episode slug/stable id used by current Reader
  routes such as `ep01`.
- `pageNumber` is the numeric public reading order, not an internal `pageId`.
  It keeps the URL short and maps directly to current Reader page navigation.
- `panelRef` is the public human-readable Panel reference for that Page, such
  as `p2-3` or `k03` when a short reference exists. The SSR facade must resolve
  it to canonical `Panel.id` before reading metadata.
- `bubbleRef` is the public human-readable Bubble reference for that Page, such
  as `p2-3-1` or `f01` when a short reference exists. The SSR facade must
  resolve it to canonical `Bubble.id` before reading metadata.
- Internal IDs such as delivery token ids, runtime feedback ids, proposal ids,
  pack draft ids, or filesystem paths must not appear in public Share URLs.

Rules:

- Hash fragments such as `#p3` are not canonical share URLs.
- Share URLs resolve the target, emit metadata, then link into the Reader. They
  are HTML routes, not `/api/v1` JSON endpoints.
- Existing focus/deep-link URLs should keep working and may redirect or render
  a safe "open shared target" prompt.
- If a non-first Page or Panel/Bubble URL is opened directly, the Reader may
  start on Page 1 for spoiler safety and show a short-lived "go to shared
  target" action outside the main reading flow.
- `pageNumber` resolves within the latest published revision for MVP. If a
  later published revision changes page ordering, old unpinned share URLs may
  resolve to the latest public reading order. The resolver must never resolve
  against draft or unpublished page order. Revision-pinned share URLs such as
  `/s/{seriesId}/{episodeId}/r/{revisionId}/p/{pageNumber}` are reserved for
  future work if immutable historical target resolution becomes necessary.
- Language is short-term query based: omit `?lang` for canonical Japanese and
  use `?lang=en` for English. Path-prefixed locale routes such as `/en/s/...`
  are future work after sitemap and `hreflang` are implemented.
- Share URL handlers must apply public-safe gates before returning
  target-specific metadata. If a target-specific Share URL is not allowed,
  return a safe 404 or redirect to the broader allowed Episode Share URL. Do
  not return broader metadata at the forbidden target-specific URL unless
  enumeration risk has been explicitly accepted.

Public-safe gate precedence:

- Public-safe checks are evaluated from Series -> Episode -> Page -> Panel ->
  Bubble.
- A deny at any ancestor level denies the requested target. Child-level
  metadata must not override ancestor-level hidden, archived, unpublished,
  deleted, merged, rights-blocked, gated, non-public visibility, invalid
  status, or unsafe flags.
- Deny wins over allow.
- The resolver must use only published content and published manifests. Draft
  content, local validation content, Pack Drafts, Proposal Queue state,
  feedback state, runtime IDs, delivery tokens, and filesystem paths must never
  generate public share metadata or OGP URLs.

Public share resolver pipeline:

1. Parse the Share URL and selected locale.
2. Resolve public Series slug/stable id and Episode slug/stable id from
   published content only.
3. Resolve the latest published revision or manifest.
4. Resolve Page number, Panel ref, or Bubble ref within that published
   revision.
5. Apply public-safe gates from Series -> Episode -> Page -> Panel -> Bubble.
6. Apply share policy for the requested target kind.
7. Select localized title and description by deterministic priority.
8. Select immutable OGP artifact or safe fallback when one exists.
9. Render SSR HTML metadata.
10. Link to the Reader route without exposing internal IDs, draft IDs, file
    paths, delivery tokens, or runtime state.

Exit criteria:

- New URL shape is documented before implementation.
- Backward compatibility and redirect behavior are documented.
- Language and canonical URL behavior are documented.
- OpenAPI is not expanded for these routes unless an actual `/api/v1` JSON
  endpoint is added. The first implementation should live in Viewer/Astro SSR
  route docs and code.
- OpenAPI must not document SSR Share facade routes. Update OpenAPI only if API
  JSON endpoints are added for public-safe gate resolution, manifest lookup, or
  metadata preview.

### 3. Description and metadata generation

Do this before OGP images. SNS crawlers need server-rendered text metadata even
when target image generation fails.

Metadata source priority:

1. Target-specific localized metadata, if present.
2. Episode localized metadata.
3. Series localized metadata.
4. Generated fallback from Series title, Episode title, Page number, Panel ref,
   Bubble quote text, and selected locale.
5. Default Manga CMS metadata.

SSR must emit metadata in the initial HTML. Do not depend on client-side
JavaScript for crawler-visible metadata.

Required fields for share pages:

- `title`
- `description`
- canonical URL
- language alternates / `hreflang` when language routes exist
- `og:title`
- `og:description`
- `og:type`
- `og:url`
- `twitter:title`
- `twitter:description`

Rules:

- For Bubble targets, localized quote text may come from a published
  Translation Pack when the selected locale differs from canonical source.
- If no text is safe to expose, fall back to Episode/Series description rather
  than leaking draft or private data.
- Description generation must be deterministic so crawler cache behavior is
  predictable.
- Series title priority is `Series.metadata.localized[locale].shareTitle`,
  `Series.metadata.localized[locale].title`, then `Series.title`.
- Episode title priority is target localized metadata, Episode localized share
  title/title, then `"{Series title} - {Episode title}"`.
- For `publicationType: "oneshot"`, generated public titles should avoid
  generic `Episode 1` display. Prefer Series title, Series share title, or the
  localized one-shot Episode title.
- Page title priority is target localized metadata, Episode title plus
  `"Page {pageNumber}"`, then Series title plus Page number.
- Panel title priority is target localized metadata, Page title plus public
  Panel ref, then Episode title plus public Panel ref.
- Bubble title priority is target localized metadata, Panel title plus public
  Bubble ref, then Episode title plus public Bubble ref.
- Series description priority is localized share description, localized
  description, then `Series.description`.
- Episode description priority is target localized metadata, Episode localized
  share description/description, Series localized description, then generated
  Series/Episode text.
- Author display priority is Series localized `authorLabel`, Series
  `metadata.authorLabel`, localized creator credit display name, creator credit
  display name, then omitted.
- Page and Panel descriptions should use target localized metadata when
  present, otherwise Episode/Series description plus Page/Panel context.
- Bubble descriptions may include quote text only when the Bubble is public,
  shareable, not spoiler-blocked by policy, and the text comes from
  `Bubble.textOriginal` for canonical Japanese or from a published Translation
  Pack for the selected non-canonical locale.
- Bubble quote descriptions use normalized source text, not visual lettering
  layout. Future `Bubble.textLayout.lines` should be ignored for crawler
  descriptions unless a separate public metadata contract says otherwise.
- Descriptions should be normalized deterministically: trim whitespace,
  collapse repeated spaces/newlines, and truncate at a fixed character budget
  without changing meaning. If truncation would expose an unsafe partial quote,
  fall back to Episode/Series description.
- Titles and descriptions must not include draft labels, private notes,
  Proposal Queue state, Pack Draft state, feedback details, runtime IDs, admin
  review comments, filesystem paths, or delivery tokens.
- Canonical URL is the Japanese Share URL without `?lang`. Short-term English
  alternate is the same Share URL with `?lang=en`. Future `/en/s/...` paths
  must not become canonical until sitemap, canonical URL, and `hreflang`
  behavior migrate together.
- When there is no OGP image, SSR should still emit text metadata and set
  `twitter:card` to `summary`. When a safe image is available, `twitter:card`
  should be `summary_large_image`.

Exit criteria:

- Share page SSR can generate useful metadata without an OGP image.
- Canonical and language alternate behavior is explicit.
- The Viewer share sheet uses the same title/description source as SSR where
  practical.

### 4. OGP artifact design and generation

Do this after metadata and URL SSR are stable.

Treat OGP images as public-safe preview artifacts, not just dynamic image API
responses. MVP can generate through the API while traffic is low, but production
should publish revisioned artifacts through the R2/manifest path described in
`docs/production-architecture.md`.

MVP default:

- MIME type: `image/png`
- Canvas: 1200 x 630 px
- Fit: contain with deterministic padding
- Background: deterministic neutral background selected by style preset
- Page OGP first
- Panel OGP second
- Bubble quote OGP later
- Clip OGP reserved for future multi-Panel share work

PNG is the default because manga line art, tone, and text are more sensitive to
JPEG compression artifacts. JPEG/WebP/AVIF and PNG quantization are future
optimization layers after visual QA.

Step 4A Page OGP first:

- Use the existing `GET /api/v1/og/page/{pageId}` facade as the beta Page OGP
  image URL only after the Share URL resolver has confirmed the target is
  public-safe.
- The Viewer `/s/...` SSR facade should pass `ogImage` to `BaseLayout` for
  Episode and Page targets when a safe Page OGP URL is resolved.
- For Episode Share URLs, prefer the first public-safe Page OGP URL, then
  Episode/Series/default image fallback.
- For Page Share URLs, prefer that Page's OGP URL.
- For Panel and Bubble Share URLs in this step, use Page OGP fallback only.
  Do not crop Panels or render Bubble quote images yet.
- Clip OGP is reserved for future work and is not part of the MVP public share
  target set.
- `og:image` and `twitter:image` must not contain raw `contents/` paths,
  local filesystem paths, or delivery-token URLs copied from Reader payloads.
  The only beta dynamic URL allowed in HTML is the stable OGP facade URL.
- `twitter:card` remains `summary` when no safe image URL is emitted. It may
  become `summary_large_image` only when `ogImage` is present and public-safe.

Temporary revision policy before R2/manifest:

- The final contract is immutable revisioned or content-hashed OGP URLs.
- Until published OGP artifact metadata exists, `/api/v1/og/page/{pageId}` is a
  compatibility facade. It is acceptable for beta/staging Page OGP because it
  does not expose raw paths and can be replaced internally later.
- If a stable revision/content hash cannot be resolved for a target-specific
  image, SSR must not invent mutable target-specific URLs. It should omit the
  image or fall back to broader public-safe Episode/Series/default metadata.
- Do not claim crawler cache-busting is solved until the URL contains a
  published revision or content hash.

Implementation handoff for Step 4A:

1. Update `apps/viewer/src/lib/share-url-metadata.ts` to return optional
   `ogImage`, `ogImageWidth`, `ogImageHeight`, and `ogImageAlt` fields.
2. Resolve Page OGP only from the API-backed Episode payload's public-safe
   Page id.
3. Update `apps/viewer/src/pages/s/[...share].astro` to pass `ogImage` to
   `BaseLayout`.
4. Keep `apps/viewer/src/layouts/BaseLayout.astro` fallback behavior: no
   `ogImage` means no image meta and `twitter:card: summary`.
5. Verify generated Share HTML does not contain raw image paths, delivery
   tokens, draft/proposal ids, or Pack Draft data.

SSR revision resolution priority:

1. Published manifest OGP artifact metadata for the exact target.
2. Runtime DB published asset metadata after assets move to DB-backed runtime
   state.
3. Canonical `contents/` metadata or generated content hash for beta dynamic
   generation.
4. Broader fallback target.

Fallback priority:

1. Page OGP PNG for Step 4A.
2. Episode OGP image.
3. Series OGP image.
4. Default Manga CMS OGP image.

Future fallback priority after Panel OGP exists:

1. Target Panel OGP PNG.
2. Page OGP PNG.
3. Episode OGP image.
4. Series OGP image.
5. Default Manga CMS OGP image.

Required OGP/X fields when an image is available:

- `og:image`
- `og:image:width`
- `og:image:height`
- `og:image:alt`
- `twitter:card`
- `twitter:image`
- `twitter:image:alt`

Rules:

- OGP image URLs must include a published revision or content hash.
- Bytes behind an existing OGP URL must never change.
- If the target is not public-safe, SSR must fall back to broader safe metadata
  instead of best-effort cropping.
- A failed crop, invalid bbox, missing image, rights block, or missing revision
  must not leak raw paths or produce mutable target-specific URLs.

Exit criteria:

- Page OGP works for at least one public-safe Episode.
- Share URL SSR emits `og:image` only when the Page OGP URL is public-safe.
- Panel/Bubble/Clip Share URLs fall back to Page/Episode/Series/default
  metadata without dynamic crop generation.
- SNS cache busting limitations are documented until revisioned URLs exist.
- Fallback behavior is tested.

### 5. SNS and crawler QA

Do this last. Do not start SNS QA until URLs, metadata, and OGP revisioning are
stable enough to avoid cache confusion.

Target services:

- X
- LINE
- Bluesky
- Discord/iMessage-style link previews where practical
- generic Open Graph crawler checks

QA checklist:

- Canonical Episode share URL.
- Page share URL.
- Panel share URL with cropped preview.
- Language-specific share URL.
- OGP fallback when Panel share is disabled.
- OGP fallback when crop generation fails.
- No raw `contents/`, delivery token, local-only, draft, feedback, Proposal, or
  Pack draft paths in HTML.

## Thread Split

Recommended parallelization after this design is accepted:

| Thread | Scope | Files |
| --- | --- | --- |
| Core/API | JSON metadata contract, OpenAPI, public-safe gates, manifest model | `docs/`, `openapi.yaml`, `packages/domain/`, `packages/schemas/`, `apps/api/` |
| Viewer | URL facades, SSR metadata, share sheet alignment | `apps/viewer/` |
| CMS | metadata editing UI and policy labels | `apps/cms/` |
| Integration QA | crawler checks and staging smoke | no broad implementation |

Do not let Viewer invent metadata fields that are not in the Core/API contract.
Do not let CMS publish target share options that the public-safe gates cannot
enforce.
