# API Contract

This document summarizes the stable contract for the current manga-cms
monorepo. It is a coordination layer for parallel development. The executable
sources of truth remain `openapi.yaml`, `packages/domain`, and
`packages/schemas`.

## Contract Sources

- HTTP API: `openapi.yaml`
- Domain types: `packages/domain/src/types.ts`
- Runtime content validation: `packages/schemas/src/content.ts`
- Content read contract: `packages/domain/src/content-loader.ts`
- Content write contract: `packages/domain/src/content-writer.ts`
- Runtime DB state: `packages/db/prisma/schema.prisma`

If this document disagrees with those files, fix this document or the contract
source explicitly. Do not let UI-local duplicated types become the source of
truth.

## Domain Model

Use this hierarchy consistently:

```text
Series
  Episode
    Page
      Panel
      Bubble
```

Canonical content JSON and TypeScript use camelCase v2 identifiers:
`pageId`, `panelId`, `bubbleId`, `stableRef`, `displayRef`,
`schemaVersion`, `editionId`, `revisionId`, `imageId`, `imageHash`, and
`coordinateSpace`. API payloads may continue to accept existing snake_case
forms where endpoints already do so, but canonical `contents/` data should not
introduce new snake_case fields.

`id` and Bubble `shortId` are legacy aliases. In v2, `pageId`, `panelId`, and
`bubbleId` are stable machine identities. `stableRef` is the durable external
source/reference identity when it differs from the machine ID. `displayRef` is
the human-facing label formerly represented by `shortId` or storyboard labels.

Entity status is optional and may be `"active"`, `"deprecated"`, `"deleted"`,
or `"merged"` for Page, Panel, and Bubble.

### Series

Canonical TypeScript shape:

```ts
type SeriesPublicationType = "serial" | "oneshot";
type SeriesLifecycleStatus = "ongoing" | "completed" | "hiatus";
type SeriesStatus = SeriesLifecycleStatus; // legacy alias
type PublicationVisibility = "public" | "hidden" | "archived";

interface Series {
  id: string;
  title: string;
  description: string;
  publicationType: SeriesPublicationType;
  lifecycleStatus: SeriesLifecycleStatus;
  status: SeriesStatus;
  coverUrl: string;
  shareImageUrl?: string;
  publishStartAt?: string;
  publishEndAt?: string;
  visibility?: PublicationVisibility;
  metadata?: ContentPublicMetadata;
  episodes: Episode[];
}
```

Storage manifest: `contents/{seriesId}/series.json`

```ts
interface SeriesManifest {
  id: string;
  title: string;
  description: string;
  publicationType?: SeriesPublicationType;
  lifecycleStatus?: SeriesLifecycleStatus;
  status: SeriesStatus;
  cover: string;
  shareImageUrl?: string;
  publishStartAt?: string;
  publishEndAt?: string;
  visibility?: PublicationVisibility;
  metadata?: ContentPublicMetadata;
  episodes: string[];
}
```

`publicationType` describes the work shape and is separate from lifecycle:

- `serial`: normal multi-Episode Series. Public cards can link to Series detail
  before the reader chooses an Episode.
- `oneshot`: single-work publication. CMS should still store one Series with
  one primary Episode; Public Reader/CMS may link cards directly to that
  Episode and omit a dedicated Series detail step.
  Public UI should avoid generic `Episode 1` labeling for `oneshot` works.
  Prefer the Series title, localized Series share title, or localized Episode
  title/reading title for cards and share metadata.

`lifecycleStatus` describes production state:

- `ongoing`: active serialization or current work.
- `completed`: finished work.
- `hiatus`: paused serial work.

`status` remains a backward-compatible alias for `lifecycleStatus`. New CMS
writes should send `publicationType` and `lifecycleStatus`; the API keeps
`status` aligned for older clients and existing content.

`coverUrl` is the canonical cover asset reference from content storage.
`shareImageUrl` is an optional stable public URL for SEO/OGP metadata. Reader
and API work should prefer `shareImageUrl` for social cards when it is present,
because page delivery URLs may be short-lived.

Scheduling fields are optional for backward compatibility. Existing Series with
no scheduling fields are treated as currently public.

### Episode

Canonical TypeScript shape:

```ts
interface Episode {
  schemaVersion?: 2;
  editionId?: string;
  revisionId?: string;
  id: string;
  episodeNumber: number;
  title: string;
  publishedAt: string;
  publishStartAt?: string;
  publishEndAt?: string;
  visibility?: PublicationVisibility;
  purchaseUrl?: string;
  redeemUrl?: string;
  metadata?: ContentPublicMetadata;
  pages: Page[];
}
```

Storage file: `contents/{seriesId}/{episodeId}/episode.json`

`publishedAt` is required in the current schema and remains a display/publication
label. It does not schedule reader availability by itself.

`purchaseUrl` and `redeemUrl` are optional public CTA URLs for entitlement-gated
Episodes. They must be root-relative or `http(s)` URLs. Public Reader gated
responses may expose these fields while still stripping `pages`.

Scheduling fields are optional for backward compatibility. Existing Episodes
with no scheduling fields are treated as currently public.

### Publication Scheduling

Series and Episode support the same optional scheduling fields:

```ts
interface PublishSchedule {
  publishStartAt?: string; // ISO 8601 date-time, inclusive
  publishEndAt?: string;   // ISO 8601 date-time, exclusive
  visibility?: "public" | "hidden" | "archived";
}
```

Rules:

- Missing fields mean `visibility: "public"` with no start/end window.
- `publishStartAt` is inclusive. If it is in the future, the content is
  scheduled and unavailable to Public Reader endpoints.
- `publishEndAt` is exclusive. If it is at or before the current request time,
  the content is expired and unavailable to Public Reader endpoints.
- `publishEndAt` must be after `publishStartAt` when both are present.
- `visibility: "hidden"` is draft/internal-equivalent. Public Reader endpoints
  return 404 and must not leak images, panels, quotes, clips, reaction entries,
  or delivery URLs.
- `visibility: "archived"` is admin-only. Public Reader endpoints return 404
  and public lists omit the content.
- Public visibility is inherited by hierarchy: an Episode is public only when
  both its parent Series and the Episode itself are currently public.
- Entitlement gating is evaluated only after publication visibility passes.
  Draft, hidden, scheduled, expired, and archived content is not represented as
  `gated: true`; it is treated as not found.
- Admin endpoints may read and write all scheduling fields regardless of current
  publication state.

### Page

Canonical TypeScript shape:

```ts
interface Page {
  schemaVersion?: 2;
  pageId: string;
  id: string; // legacy alias for pageId in loaded domain objects
  stableRef: string;
  pageNumber: number;
  images: Record<string, string | undefined>;
  imageId?: string;
  imageHash?: string;
  coordinateSpace?: "pixel";
  width: number;
  height: number;
  displayRef?: string;
  status?: ContentEntityStatus;
  flags?: ContentFlags;
  metadata?: ContentPublicMetadata;
  panels: Panel[];
  bubbles: Bubble[];
}
```

Rules:

- `pageNumber` is 1-based.
- `images` is keyed by locale such as `ja` or `en`.
- `panels` and `bubbles` are independent Page-level arrays.
- `schemaVersion: 2` marks canonical content using Page-level Bubbles.
- `editionId` and `revisionId` are Episode-level revision metadata for
  editorial/version tracking.
- MVP coordinates use pixel space. `coordinateSpace` is `"pixel"` and BBox
  metadata should identify the Page image via `imageId`.
- Public reader responses should use delivery URLs, not raw origin paths, when
  image entitlement or tokenization is relevant.
- Admin image endpoints may expose controlled preview paths for authenticated
  CMS editing.

### Panel

Canonical TypeScript shape:

```ts
interface Panel {
  panelId: string;
  id: string; // legacy alias for panelId in loaded domain objects
  stableRef: string;
  displayRef?: string;
  status?: ContentEntityStatus;
  panelNumber: number;
  bbox: BoundingBox;
  reactionTags: string[];
  flags?: ContentFlags;
  metadata?: ContentPublicMetadata;
}
```

Rules:

- `panelNumber` is 1-based within a Page.
- `bbox` is stored in page coordinate space.
- Panel no longer owns `bubbles`. Use Page `bubbles[]` and match
  `bubble.panelId` to `panel.panelId`.
- `reactionTags` supports official reaction search and should not be treated as
  an unrestricted public tagging system.

### Bubble

Canonical TypeScript shape:

```ts
type BubbleType = "speech" | "thought" | "narration" | "sfx" | "caption" | "other";
type TextDirection = "horizontal" | "vertical";
type SpeakerConfidence = "confirmed" | "inferred" | "unknown";

interface Bubble {
  bubbleId: string;
  id: string; // legacy alias for bubbleId in loaded domain objects
  panelId: string | null;
  stableRef: string;
  displayRef?: string;
  status?: ContentEntityStatus;
  bubbleNumber: number;
  shortId?: string; // legacy alias for displayRef
  bubbleType: BubbleType;
  textOriginal: string;
  speaker?: string;
  speakerConfidence?: SpeakerConfidence;
  textDirection?: TextDirection;
  lang?: string;
  flags?: ContentFlags;
  metadata?: ContentPublicMetadata;
  bbox: BoundingBox;
}
```

Rules:

- `bubbleNumber` is 1-based within a Page.
- `panelId` links the Bubble to a Panel. `panelId: null` is valid for page-level
  captions, SFX, or source text that has not been attached to a Panel.
- `displayRef` is a display/share helper, not a replacement for stable
  `bubbleId`.
- Speaker metadata is optional until editorial confidence is available.
- `textOriginal` is canonical source text, not a lettering layout field. Do
  not treat half-width spaces as automatic line breaks, word separators for
  vertical lettering, or panel-layout hints.
- Line breaks and typesetting hints should be modeled as optional layout
  metadata in a v2-compatible extension, for example
  `textLayout.lines: string[]`. Existing content must not be auto-converted
  from spaces or punctuation; CMS reviewers should set line layout explicitly.

Text layout design:

```ts
interface BubbleTextLayout {
  // Human-reviewed source text split for lettering/typesetting display.
  lines?: string[];
  // Reserved for future display hints such as vertical flow or ruby grouping.
  source?: "manual" | "imported" | "ocr";
}
```

`textLayout.lines` is the preferred future field over top-level `textLines`
because it keeps source text, layout, and future lettering hints grouped
without changing the meaning of `Bubble.textOriginal`. It is design-level only
until domain and schema fields are added.

Comparison:

- Raw `\n` inside `textOriginal` preserves line breaks in one field and is easy
  for plain text editors, but it makes canonical source text ambiguous for
  translation memory, search, speech synthesis, CSV/TSV export, and share
  descriptions.
- `textLayout.lines` keeps canonical text and lettering layout separate.
  Readers, CMS previews, and future exports can opt into layout lines while
  translation, search, and accessibility keep using normalized source text.

Impact:

- Translation Pack entries continue to target `Bubble.textOriginal` as source
  text. Translation line layout belongs in Pack entry metadata or a future Pack
  text layout field, not in canonical Bubble source text.
- Full-text export should export `textOriginal` as the source of truth and may
  include layout lines as optional extra columns/JSON fields.
- Share descriptions should ignore layout lines and use normalized public-safe
  text so crawler metadata is deterministic.
- Read-aloud and search should use `textOriginal` with normal whitespace
  normalization, not visual line layout.
- CMS may display layout lines for proofreading/typesetting, but must not
  infer them from half-width spaces.

No `schemaVersion: 3` migration is needed while layout is optional and
`textOriginal` keeps its existing meaning. A future v3 is justified only if
layout lines become required, if `textOriginal` semantics change, or if old
content must be migrated to a new canonical text representation.

### Content Lint Warnings

`packages/schemas/src/content.ts` owns two layers:

- Zod schema validation for hard invalid content.
- `lintPageContent(page)` for review warnings and recoverable content issues.

Lint warnings must not be treated as schema failures unless a caller
explicitly opts into warning-as-error behavior for CI or editorial policy.
They are meant for CMS review gates.

Current lint codes:

| Code | Severity | Meaning |
| --- | --- | --- |
| `INVALID_PANEL_REF` | `error` | A Bubble references a `panelId` that does not exist on the Page. |
| `BBOX_OUT_OF_BOUNDS` | `warning` | A Panel or Bubble bbox extends beyond the Page dimensions. This can be intentional for bleed. |
| `BUBBLE_OUTSIDE_PANEL_BBOX` | `warning` | A Bubble is linked to a Panel, but its bbox is not contained by the Panel bbox. |
| `READING_ORDER_SUSPECT` | `warning` | Saved `panelNumber` order disagrees with the default RTL manga reading-order estimate for more than half the Page Panels. |

`READING_ORDER_SUSPECT` follows `docs/reading-order-spec.md`. It is only a
heuristic review signal. It must not silently reorder canonical content or make
unusual layouts invalid.

### Shared Supporting Types

```ts
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  imageId?: string;
  coordinateSpace?: "pixel";
}

interface ContentFlags {
  shareable: boolean;
  feedback_enabled: boolean;
  contains_spoiler?: boolean;
}

type ShareTargetKind = "episode" | "page" | "panel" | "bubble" | "clip";
type OgpTargetKind = "page" | "panel" | "bubble" | "clip";

// `clip` is reserved for future multi-Panel share work. MVP public share
// resolvers expose Episode, Page, Panel, and Bubble only.

interface LocalizedContentMetadata {
  title?: string;
  description?: string;
  shareTitle?: string;
  shareDescription?: string;
  authorLabel?: string;
}

interface PublicImageReference {
  path?: string;
  url?: string;
  imageId?: string;
  contentHash?: string;
  revisionId?: string;
  alt?: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

interface CreatorCredit {
  role?: string;
  displayName: string;
  localizedDisplayNames?: Record<string, string>;
  url?: string;
  sortOrder?: number;
}

interface ContentPublicMetadata {
  // Publish-generated hints. CMS editors should not hand-edit cache keys.
  revisionId?: string;
  publishedRevisionId?: string;
  contentHash?: string;
  publishedAt?: string;
  canonicalLocale?: string;
  availableLocales?: string[];
  defaultReaderLocale?: string;
  authorLabel?: string;
  creatorCredits?: CreatorCredit[];
  localized?: Record<string, LocalizedContentMetadata>;
  pageImages?: Record<string, PublicImageReference>;
  coverImage?: PublicImageReference;
  shareImage?: PublicImageReference;
  shareImageAlt?: string;
  sharePolicy?: {
    allowedTargets?: ShareTargetKind[];
  };
  ogpPolicy?: {
    allowedTargets?: OgpTargetKind[];
    allowCrop?: boolean;
    stylePreset?: string;
  };
  publicSafety?: {
    rightsClearedForPreview?: boolean;
    hidden?: boolean;
    archived?: boolean;
  };
}

type ContentEntityStatus = "active" | "deprecated" | "deleted" | "merged";
```

`metadata?: ContentPublicMetadata` is a v2-compatible optional extension for
public share metadata. It can appear on Series, Episode, Page, Panel, and
Bubble. Missing metadata means legacy behavior: use existing title,
description, `publishedAt`, `publishStartAt`, `publishEndAt`, `visibility`,
`status`, `flags`, `Page.images`, `coverUrl`, and `shareImageUrl` fields.
`metadata.localized` is crawler/share metadata, not canonical translated manga
text. `Bubble.textOriginal` remains the canonical source text, and translated
reader text remains in Translation Packs or Pack Drafts. `metadata.pageImages`
can describe language-specific published/share image artifacts, but canonical
Page image references remain `Page.images`.

Creator display is part of public metadata. MVP may use
`metadata.authorLabel` as a single display string. Locale-specific display can
use `metadata.localized[locale].authorLabel`. Future CMS can expand to
`metadata.creatorCredits[]` with ordered role/display entries, but public UI
should prefer `authorLabel` while only one creator string is needed.

Episode may carry `metadata.localized[locale].title`,
`description`, `shareTitle`, and `shareDescription` independently from Series.
For `publicationType: "oneshot"`, title generation should not force
`Episode 1`; it should prefer localized Series or Episode share titles and use
Episode numbering only when no better public title exists.

`Page.images` is keyed by locale. `ja` is the canonical source image key and
`en` may point at a localized page image. Reader and OGP selection should
prefer the requested locale key, then `metadata.defaultReaderLocale` or
`metadata.canonicalLocale`, then `ja`, and finally the first available image.
Public HTML must still expose only delivery-contained or published artifact
URLs, not raw storage paths.

The current MVP uses one optional `ContentPublicMetadata` container to avoid a
breaking content migration. Implementations must still treat fields as
entity-scoped. For example, Bubble metadata should not use Series cover image
fields, and Page image metadata should not be invented for Panel or Bubble
targets. Before expanding the field set further, prefer entity-specific shapes
such as `SeriesPublicMetadata`, `EpisodePublicMetadata`,
`PagePublicMetadata`, `PanelPublicMetadata`, and `BubblePublicMetadata`.

Editable content metadata is separate from published artifact metadata. Editors
may set localized titles/descriptions, share policy, OGP policy, image
references, and public-safety hints. Published revision ids, content hashes,
immutable OGP artifact URLs, and cache keys are generated by the publish
pipeline or manifest layer and should be read-only in CMS UI.

Deletion is an entity lifecycle state (`status: "deleted"`), not
`metadata.publicSafety`. Public safety metadata only carries additional hints
such as `rightsClearedForPreview`, `hidden`, and `archived`.

Do not bump `schemaVersion` to 3 for this extension. A v3 migration is only
needed if metadata becomes required, if existing v2 field meanings change, or
if canonical content moves out of the current Series/Episode/Page/Panel/Bubble
JSON shape.

## Current Content Source

`contents/` is canonical for manga content today:

```text
contents/
  {seriesId}/
    series.json
    {episodeId}/
      episode.json
      pages/
        p01.jpg
        p02.jpg
```

`packages/domain/src/content-loader.ts` loads and validates this structure with
Zod schemas from `packages/schemas`.

`packages/domain/src/content-writer.ts` writes Series and Episode data to this
filesystem shape. It is designed to be swappable later, but current work should
not assume DB-backed canonical content.

## Public Reader Endpoints

Base path: `/api/v1`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API and DB health check |
| `GET` | `/series` | List public Series summaries |
| `GET` | `/series/{seriesId}` | Read Series detail and Episode summaries |
| `GET` | `/series/{seriesId}/episodes/{episodeId}` | Read Episode metadata and navigation |
| `GET` | `/series/{seriesId}/episodes/{episodeId}/pages/{pageNumber}` | Read reader Page payload |
| `GET` | `/quotes/{seriesId}/{episodeId}/{pageNumber}/{panelNumber}/{bubbleNumber}` | Read Bubble quote payload |
| `GET` | `/clips/{seriesId}/{episodeId}/{pageNumber}/{panelStart}/{panelEnd}` | Read Panel range clip payload |
| `GET` | `/reactions` | Search official reaction Panels |
| `POST` | `/feedback` | Submit reader feedback |
| `GET` | `/feedback/{feedbackId}/status` | Read minimal public feedback status |
| `POST` | `/identity/github/oauth/callback` | Server-side GitHub identity verification callback skeleton |
| `GET` | `/deliver/{pageId}` | Token-verified image delivery |
| `GET` | `/og/page/{pageId}` | Stable Page OGP image URL that redirects through delivery |

Public reader endpoints must be safe for unauthenticated requests unless the
route explicitly accepts optional auth. Entitlement-gated content must return a
gated response or omit protected image URLs rather than leaking origin paths.

`GET /og/page/{pageId}` is the stable public OGP image URL for Episode/Page
sharing. The current MVP supports public free Episode pages only and returns a
`302` redirect to `/deliver/{pageId}?lang=...&token=...` with public cache
headers on the redirect. It does not expose raw `contents/` filesystem paths.
The route is intentionally a stable facade so future dynamic OGP composition
can replace the redirect without changing Viewer metadata URLs.

### Share URL And Target OGP Design

Implementation order and migration boundaries are defined in
`docs/public-share-metadata-roadmap.md`. In short: update the content metadata
contract first, then define Share URLs, then SSR descriptions, then OGP
artifacts, and only then run SNS crawler QA.

Existing Reader URLs must remain stable. SNS-oriented share surfaces should use
separate canonical Share URLs that SSR HTML metadata without changing the main
Reader route shape:

```text
/s/{seriesId}/{episodeId}
/s/{seriesId}/{episodeId}/p/{pageNumber}
/s/{seriesId}/{episodeId}/p/{pageNumber}/k/{panelRef}
/s/{seriesId}/{episodeId}/p/{pageNumber}/f/{bubbleRef}
```

Share URLs are public HTML facades, not API endpoints. They are intentionally
not added to `openapi.yaml` unless a future `/api/v1` JSON endpoint is created
for the same behavior. The first implementation belongs in Viewer/Astro SSR
routes so crawlers receive metadata in the initial HTML.

Canonical route parameter decisions:

- `seriesId` is the public Series slug/stable id already used by Reader routes
  such as `oumaga-dokidoki`.
- `episodeId` is the public Episode slug/stable id already used by Reader
  routes such as `ep01`.
- `pageNumber` is the numeric public reading order. It is not an internal
  `Page.id` and should not expose filesystem naming.
- `pageNumber` resolves within the latest published revision for MVP. If a
  future published revision changes page ordering, old unpinned Share URLs may
  resolve to the latest public reading order. The resolver must never resolve
  against draft or unpublished page order. Revision-pinned Share URLs such as
  `/s/{seriesId}/{episodeId}/r/{revisionId}/p/{pageNumber}` are reserved for
  future work if immutable historical target resolution becomes necessary.
- `panelRef` is a public, human-readable Panel reference scoped to the Page,
  such as `p2-3` or `k03` when available. The SSR route resolves it to
  canonical `Panel.id`.
- `bubbleRef` is a public, human-readable Bubble reference scoped to the Page,
  such as `p2-3-1` or `f01` when available. The SSR route resolves it to
  canonical `Bubble.id`.

Share URLs resolve the target, check publication and reader policy, emit OGP/X
metadata, then deep-link into the existing Reader experience. A target Share URL
must not expose raw filesystem paths, draft IDs, delivery token internals,
runtime proposal IDs, Pack draft IDs, or private feedback state.

Language behavior:

- Omit `?lang` for the canonical Japanese reading/share experience.
- Use `?lang=en` for the current English reader and share experience.
- Path-prefixed language routes such as `/en/s/...` remain future work until
  sitemap, canonical, and `hreflang` behavior are implemented together.

Spoiler-safe reader behavior:

- Canonical Share HTML may describe a Page/Panel/Bubble target for crawlers.
- When a human opens a non-first Page/Panel/Bubble Share URL, the Reader may
  still start on Page 1 by default and show a short-lived "shared target"
  action that moves to the target.
- Page-only Reader hash links such as `#p3` remain backward-compatible, but
  they are not crawler canonical Share URLs.

Public-safe failure behavior:

- Return 404 for draft, scheduled, expired, archived, hidden, deleted, merged,
  gated, or rights-uncleared targets.
- If a target-specific Share URL is not allowed, either return a safe 404 or
  redirect to the broader allowed Episode Share URL. Do not return broader
  metadata at the forbidden target-specific URL unless enumeration risk has
  been explicitly accepted.
- Never fall back by exposing a private or mutable target-specific URL.

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

### Share Metadata Generation

Share URLs are SSR HTML facades, so crawler-visible metadata must be rendered
in the initial HTML. Do not rely on client-side JavaScript to insert or replace
canonical, Open Graph, or X/Twitter text metadata. These Share HTML routes are
not executable `/api/v1` JSON routes and are intentionally not represented in
`openapi.yaml`; OpenAPI should only change if a future API endpoint returns
this metadata as JSON.

OpenAPI must not document SSR Share facade routes. Update OpenAPI only if API
JSON endpoints are added for public-safe gate resolution, manifest lookup, or
metadata preview.

Selected locale:

- Japanese is canonical. The canonical Share URL omits `?lang`.
- Short-term English metadata uses the same Share URL with `?lang=en`.
- Future path-prefixed locale routes such as `/en/s/...` are reserved until
  sitemap, canonical URL, and `hreflang` migration happen together.

Title generation priority:

1. Target-level `metadata.localized[locale].shareTitle`.
2. Target-level `metadata.localized[locale].title`.
3. Parent Episode localized share title/title.
4. Parent Series localized share title/title.
5. Deterministic generated fallback:
   - Series: Series title.
   - Episode: `{Series title} - {Episode title}`.
   - Page: `{Episode title} - Page {pageNumber}`.
   - Panel: `{Episode title} - Page {pageNumber}, Panel {panelRef}`.
   - Bubble: `{Episode title} - Page {pageNumber}, Bubble {bubbleRef}`.

Description generation priority:

1. Target-level `metadata.localized[locale].shareDescription`.
2. Target-level `metadata.localized[locale].description`.
3. Episode localized share description/description.
4. Series localized share description/description.
5. Deterministic generated fallback from Series title, Episode title, Page
   number, Panel ref, Bubble quote text when allowed, and selected locale.
6. Default Manga CMS public description.

Author/creator display priority for public cards and Share URL SSR:

1. Series `metadata.localized[locale].authorLabel`.
2. Series `metadata.authorLabel`.
3. First matching Series `metadata.creatorCredits[].localizedDisplayNames[locale]`.
4. First Series `metadata.creatorCredits[].displayName` by `sortOrder`.
5. Omit author metadata when no public creator label exists.

Do not derive creator labels from private CMS notes, Pack author labels,
feedback contributor names, Proposal Queue submitters, or GitHub identities.

Bubble quote text may be included in `description`, `og:description`, and
`twitter:description` only when all of these are true:

- Bubble target passes publication, entitlement, rights, and reader-policy
  gates.
- Bubble `status` is active or otherwise allowed for public sharing.
- Bubble `flags.shareable` is not false and spoiler policy permits quote text.
- Locale is canonical Japanese and the quote comes from `Bubble.textOriginal`,
  or locale is non-canonical and the quote comes from a published Translation
  Pack. Runtime Pack Drafts and Proposal Queue text are never crawler-visible.

Generated text must be deterministic: trim leading/trailing whitespace, collapse
repeated spaces/newlines, strip control characters, and truncate to a fixed
budget before emitting HTML. If truncating a Bubble quote would create unsafe
or misleading partial text, drop the quote and fall back to Episode/Series
description.

The following data must never appear in title or description metadata: draft
labels, private admin notes, feedback contents, Proposal Queue state, Pack
Draft state, unpublished Pack text, runtime IDs, filesystem paths, delivery
tokens, client IPs, user agents, or moderation/audit fields.

Share URL SSR must emit text metadata even when no safe image exists:

- `title`
- `description`
- canonical URL
- language alternates / `hreflang` for currently supported locale URLs
- `og:title`
- `og:description`
- `og:type`
- `og:url`
- `twitter:title`
- `twitter:description`
- `twitter:card`

Use `og:type: article` for Series/Episode/Page/Panel/Bubble Share pages unless
a future product-specific type is explicitly documented. Use `twitter:card:
summary` when no safe OGP image exists. Use `summary_large_image` only when a
safe image is available.

Panel OGP should be treated as a public-safe preview artifact. The intended
image source is the published Page image cropped by the canonical Panel `bbox`.
MVP output should default to `image/png` because manga line art and text are
more sensitive to compression artifacts than photo-like images. JPEG, WebP,
AVIF, PNG quantization, and palette reduction are future optimization choices,
not the default contract.

Page OGP comes first. Before Panel crop generation exists, Share URL SSR may
use the existing `GET /api/v1/og/page/{pageId}` facade as the beta Page OGP
image URL for public-safe Episode/Page targets. This route is a stable facade
over delivery containment; Share HTML must not copy raw Reader image URLs,
short-lived `/deliver` token URLs, or origin filesystem paths into `og:image`.
For Panel and Bubble Share URLs, the Step 4A fallback is Page OGP, then Episode,
Series, then default OGP metadata. Panel OGP, Bubble/quote OGP, and Clip OGP
remain later phases.

`/api/v1/og/page/{pageId}` is not the final immutable artifact shape. It is
acceptable for staging/beta only because it keeps the public HTML free of raw
paths and lets the implementation switch internals later. Once published OGP
artifact metadata exists, Share URL SSR should prefer revisioned or
content-hashed manifest URLs and stop treating the dynamic facade as the
primary crawler URL.

Panel OGP image layout should target a 1200 x 630 px canvas. Generation should
preserve the complete Panel crop by using contain-fit with deterministic
padding rather than cutting long vertical or wide horizontal Panels. Background
and padding color should be neutral and deterministic per style preset.
Bubble/quote OGP remains design-level: a future quote OGP may combine a Bubble
target, quote text, and Panel/Page context, but it must follow the same
visibility, rights, revision, and fallback rules as Panel OGP. Clip OGP is
reserved for future multi-Panel share work and is not part of MVP public share
targets.

Share URL SSR should return these metadata fields when a target is public-safe:

- `og:title`
- `og:description`
- `og:type`
- `og:url`
- `og:image`
- `og:image:width`
- `og:image:height`
- `og:image:alt`
- `twitter:card`
- `twitter:title`
- `twitter:description`
- `twitter:image`
- `twitter:image:alt`

`twitter:card` should remain `summary` when no safe `og:image` is emitted. It
may become `summary_large_image` only when `og:image` is present and has passed
the same public-safe gates as the Share URL target. `og:url` should be the
canonical Share URL, while final-state `og:image` and `twitter:image` should be
immutable revisioned image URLs.

OGP image URLs should include either a published revision or a content hash.
The same OGP image URL must not change bytes after SNS crawlers cache it.
During SSR, revision resolution should use this priority:

1. Published artifact metadata from the manifest for the exact Page/Panel/Bubble
   target.
2. Runtime DB metadata after published asset state moves to DB-backed runtime
   state.
3. Canonical `contents/` manifest or generated content hash for beta dynamic
   generation.
4. Fallback target image when no stable revision can be resolved.

If revision cannot be resolved for the requested target, SSR should not invent a
mutable target-specific image URL. It should fall back to the next broader
public-safe target.

Step 4A Page OGP fallback priority:

1. Page OGP image.
2. Episode OGP image.
3. Series OGP image.
4. Default Manga CMS OGP image.

Future fallback priority after Panel OGP exists:

1. Panel OGP image.
2. Page OGP image.
3. Episode OGP image.
4. Series OGP image.
5. Default Manga CMS OGP image.

Fallback is required when the Panel `bbox` is invalid, the Page image cannot be
read, generation fails, the target is not public, policy disables Panel sharing
or OGP crop, rights are not cleared, or a stable revision/hash is unavailable.

Public-safe gates are mandatory before SSR exposes target-specific metadata or
image URLs:

- Series and Episode are public now, not draft, scheduled, expired, hidden, or
  archived.
- Target Page/Panel/Bubble exists and is not deleted or merged.
- Entitlement/gating allows the target to be shared publicly.
- Reader interaction policy allows the target share kind and OGP kind.
- Target `flags.shareable` is not false.
- Future rights policy has cleared public preview use.
- Future CMS OGP policy allows crop generation for the target.

MVP may generate Panel OGP dynamically through the API as long as the same
delivery containment logic is used, but commercial/high-traffic production
should publish OGP images as immutable artifacts through the R2 manifest path
described in `docs/production-architecture.md`.

### Reader Interaction Policy

Reader interaction policy controls which share, report, OGP, SNS share, and
simple-viewer features are exposed to Reader and CMS. The detailed contract is
defined in `docs/reader-policy-spec.md`.

The policy is runtime configuration layered over canonical content:

```text
system default
  -> default policy override
  -> Series override
  -> Episode override
  -> target ContentFlags / status / visibility gates
```

Policy can reduce Reader surfaces, but it cannot make hidden, archived,
scheduled, expired, gated, deleted, or merged content public.

Public effective policy endpoints proposed for the next API implementation:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/series/{seriesId}/reader-policy` | Read effective Series reader policy for Viewer |
| `GET` | `/series/{seriesId}/episodes/{episodeId}/reader-policy` | Read effective Episode reader policy for Viewer |

Admin draft policy endpoints proposed for CMS:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/reader-policies` | List stored reader policy overrides, optionally with effective policy |
| `PUT` | `/admin/reader-policies/{scopeType}/{scopeId}` | Upsert a default, Series, or Episode reader policy override |

Public effective policy may expose `shareTargets`, `reportTargets`,
`ogpTargets`, `snsShareServices`, `feedbackDisplay`, `simpleViewerMode`,
`features`, inheritance flags, and `updated_at`. Admin-only fields such as
editor notes, unpublished draft metadata, `updated_by`, audit history, private
feedback counts, moderation queues, and rights records must stay out of public
responses.

File-backed MVP storage can live under `READER_POLICY_DIR`, defaulting to
`reader-policies/reader-policies.jsonl`, with local locking and one override
record per scope. Multi-instance production should move the same record shape
to `packages/db` runtime state with a unique `(scope_type, scope_id)` key. The
policy store must remain separate from canonical `contents/` data.

`POST /feedback` stores private runtime feedback for CMS triage only. It never
creates GitHub Issues, PRs, comments, Packs, or canonical `contents/` changes.
The public endpoint accepts missing identity, `anonymous`, or `display_name`
contributor identity. Verified `github_login` identity requires a server-side
GitHub verification path and is not accepted by public Reader submissions in
the current API skeleton. `contributor_terms_accepted` is an optional boolean
for Reader UIs to record contributor terms acknowledgement; missing remains
valid for backward compatibility with existing submissions.

`GET /feedback/{feedbackId}/status` lets the submitter check the stored
feedback status later using the returned `feedback_id`. It is intentionally
minimal and returns only `feedback_id`, `status`, `created_at`, and optional
`triaged_at`; it does not expose comments, suggested text, contributor
identity, client IP, user agent, or admin triage notes.

`POST /identity/github/oauth/callback` is the contracted server-side path for
turning a GitHub OAuth callback into a verified `github_login` contributor
identity. The route currently validates the callback payload and returns 501
until token exchange and GitHub user lookup are wired. It does not post to
GitHub or create Issues/PRs.

Public Reader visibility:

- `/series` returns only currently public Series. `episodeCount` counts only
  currently public Episodes.
- `/series/{seriesId}` returns 404 for non-public Series and includes only
  currently public Episodes.
- `/series/{seriesId}/episodes/{episodeId}` and `/pages/{pageNumber}` return
  404 for draft/hidden, scheduled, expired, or archived Series/Episodes.
- `/quotes`, `/clips`, `/reactions`, and `/deliver/{pageId}` also exclude
  draft/hidden, scheduled, expired, and archived content.
- Episode and Page reader payloads may include `availablePacks`. This array is
  built only from canonical `packs/{packId}/pack.json` manifests with
  `isPublished: true`; runtime Pack drafts and unpublished manifests are not
  exposed to Public Reader clients.
- `availablePacks` entries are scoped to the returned Page. Public payloads
  include Pack identity, display metadata, target, text/note fields, and omit
  runtime draft/proposal identifiers and private entry metadata.

Current CMS/Reader endpoint coverage:

- CMS uses `/series`, `/series/{id}`, `/admin/series`,
  `/admin/series/{id}`, `/admin/series/{id}/episodes`,
  `/admin/series/{id}/episodes/{epId}`,
  `/admin/series/{id}/episodes/{epId}/pages/{pageNumber}/image`,
  `/admin/series/{id}/publish`, ingestion routes, feedback triage routes, auth
  routes, Proposal Queue routes, Pack draft routes, and entitlement admin
  routes. These are implemented by `apps/api`.
- Reader SSR uses `/series/{seriesId}/episodes/{episodeId}`, `/quotes/...`,
  `/clips/...`, `/reactions`, `/feedback`, and tokenized `/deliver/{pageId}`.
  These are implemented by `apps/api`.
- Public Reader Pack availability is embedded in Episode/Page reader payloads.
  Standalone `/packs/{packId}`, public Pack listing, and public proposal
  listing are not implemented in `apps/api` and are not part of the current
  core contract. Reintroduce them in `openapi.yaml` only when the implementation
  exists or a task explicitly schedules that surface.

CMS text export is design-level only for now. The MVP should be client-side in
CMS using the already-loaded admin Episode payload and should not add an API
route. See `docs/cms-text-export-spec.md`. If server-side export is needed
later, add an admin-only route to `openapi.yaml` and keep canonical
`Bubble.textOriginal` export separate from Translation Pack Draft export.

## CMS Admin Endpoints

Base path: `/api/v1`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/series` | List manageable Series for CMS editing, including hidden/scheduled/expired content |
| `POST` | `/admin/series` | Create Series |
| `GET` | `/admin/series/{id}` | Read Series for CMS editing, including all Episode summaries |
| `PUT` | `/admin/series/{id}` | Update Series metadata |
| `POST` | `/admin/series/{id}/episodes` | Create or save Episode |
| `PUT` | `/admin/series/{id}/episodes/{epId}` | Update Episode |
| `GET` | `/admin/series/{id}/episodes/{epId}` | Read full Episode for CMS editing |
| `GET` | `/admin/series/{id}/episodes/{epId}/pages/{pageNumber}/image` | Read admin Page image preview |
| `POST` | `/admin/series/{id}/episodes/{epId}/pages/{pageNumber}/image` | Upload Page image and update Episode image path |
| `POST` | `/admin/series/{id}/publish` | Reload/publish Series data |
| `GET` | `/admin/identity/github/verifications` | List verified GitHub identity records |
| `POST` | `/admin/identity/github/verifications` | Create a trusted-admin verified GitHub identity record |
| `GET` | `/admin/identity/github/verifications/{verificationId}` | Read one verified GitHub identity record |
| `POST` | `/admin/identity/github/verifications/{verificationId}/revoke` | Revoke a verified GitHub identity record |
| `GET` | `/admin/feedback` | List private Reader feedback for CMS triage |
| `GET` | `/admin/feedback/{feedbackId}` | Read one feedback record |
| `PUT` | `/admin/feedback/{feedbackId}/status` | Update feedback status and triage note |
| `POST` | `/admin/feedback/{feedbackId}/proposal` | Convert feedback into a Proposal Queue record |
| `POST` | `/admin/feedback/{feedbackId}/github-handoff` | Queue GitHub handoff intent for one feedback record |
| `GET` | `/admin/proposals` | List Proposal Queue records |
| `POST` | `/admin/proposals` | Create a Proposal Queue record |
| `GET` | `/admin/proposals/{proposalId}` | Read one proposal record |
| `PUT` | `/admin/proposals/{proposalId}/status` | Update proposal review status and note |
| `POST` | `/admin/proposals/{proposalId}/github-handoff` | Queue GitHub handoff intent for one proposal record |
| `GET` | `/admin/github-handoffs` | List private GitHub handoff queue records |
| `POST` | `/admin/github-handoffs` | Queue private GitHub handoff intent |
| `POST` | `/admin/github-handoffs/triage-draft` | Generate a Markdown triage draft from queued handoff records |
| `POST` | `/admin/github-handoffs/sync-dry-run` | Dry-run the GitHub handoff sync worker without posting |
| `GET` | `/admin/github-handoffs/sync-attempts` | List GitHub handoff sync-attempt records |
| `POST` | `/admin/github-handoffs/sync-attempts/planned` | Store a planned sync attempt from the current dry-run result |
| `GET` | `/admin/github-handoffs/sync-attempts/{attemptId}` | Read one GitHub handoff sync-attempt record |
| `PUT` | `/admin/github-handoffs/sync-attempts/{attemptId}/status` | Update sync-attempt lifecycle status |
| `GET` | `/admin/github-handoffs/{handoffId}` | Read one GitHub handoff queue record |
| `PUT` | `/admin/github-handoffs/{handoffId}/status` | Update GitHub handoff queue status |
| `GET` | `/admin/pack-drafts` | List runtime Pack draft records |
| `POST` | `/admin/pack-drafts` | Create a runtime Pack draft |
| `GET` | `/admin/pack-drafts/{packDraftId}` | Read one runtime Pack draft |
| `PUT` | `/admin/pack-drafts/{packDraftId}/status` | Update Pack draft review status |
| `POST` | `/admin/pack-drafts/{packDraftId}/adopt-proposal` | Adopt an accepted Proposal into a Pack draft |
| `POST` | `/admin/pack-drafts/{packDraftId}/translation-import` | Validate/apply Bubble-level translation rows into a Translation Pack draft |
| `POST` | `/admin/pack-drafts/{packDraftId}/export` | Export an approved/published Pack draft to `packs/{packId}/pack.json` |
| `GET` | `/admin/rights/grants` | List runtime Rights grants |
| `POST` | `/admin/rights/grants` | Create a runtime Rights grant |
| `POST` | `/admin/rights/grants/{grantId}/revoke` | Revoke a runtime Rights grant and record revoke audit |
| `POST` | `/admin/rights/check` | Check whether a user has a Rights permission |

Admin endpoints require authenticated CMS access. Global admins are identified
by the auth session/API key role `admin` and can operate on all Series. Series
scoped CMS content endpoints also accept authenticated users with an active
Rights grant for that `scope.series_id`. Browser CMS calls should send
credentials so the `manga_auth` cookie is included.

Current Series-scoped enforcement:

- `GET /admin/series` returns all Series for global admins and only manageable
  Series for users with active Series grants.
- `GET /admin/series/{id}`, admin Episode reads, and admin Page image previews
  require any active Series admin permission, such as `edit_structure`,
  `edit_translation`, `review_translation`, `approve_translation`,
  `publish_pack`, `manage_rights`, or `moderate_proposals`.
- `PUT /admin/series/{id}`, Episode writes, Page image upload, and
  `/admin/series/{id}/publish` require `edit_structure` or `manage_rights` for
  that Series unless the user is a global admin.
- `POST /admin/series` remains global-admin-only because a new Series has no
  pre-existing Series scope.
- Rights grant list/create/revoke is global-admin-only for broad scopes, and
  Series managers with `manage_rights` can manage grants bounded to their own
  `scope.series_id`.

Current unscoped admin surfaces remain global-admin-only: Pack draft,
feedback, proposal, ingestion, GitHub handoff, entitlement, and identity
administration. This is not treated as a security hole; it is the remaining
Series-scoped user feature coverage. CMS should avoid surfacing these global
admin tools to Series-scoped users until each area receives explicit
Series-scope enforcement.

### CMS Content Editing Contract

CMS canonical editing remains file-backed through `contents/` and is limited
to admin routes. These routes are the API source for CMS screens that edit
manga metadata and structure:

- `PUT /admin/series/{id}` updates Series metadata only: title, description,
  publication type, lifecycle status, legacy status, cover, share image URL,
  publish window, and visibility. It does not change Episodes, Pages, Panels,
  Bubbles, Packs, or runtime review queues.
- `PUT /admin/series/{id}` accepts `metadata` as a partial public metadata
  patch. Object fields are deep-merged with existing Series metadata so CMS can
  send only `authorLabel` or one `localized[locale]` entry without deleting
  existing metadata. Sending `metadata: null` explicitly clears Series
  metadata.
- `GET /admin/series/{id}/episodes/{epId}` returns the full Episode for CMS
  review/editing, including `pages[].panels[]`, `pages[].bubbles[]`, and
  `Bubble.textOriginal`.
- `PUT /admin/series/{id}/episodes/{epId}` replaces the Episode JSON for
  Episode metadata, Page structure, Panel bboxes/order, Bubble bboxes/order,
  and Japanese source text edits. CMS must send the complete Episode payload it
  wants to persist.

Canonical Bubble source text is `Bubble.textOriginal` and should remain the
Japanese/original text for the current content edition. English or other
translated text must not be written into `Bubble.textOriginal`, `Page.images`,
or a duplicated English Series. Translation work enters runtime
`TRANSLATION` Pack drafts first, then can be exported as a canonical Pack only
after review.

For compatibility with strict schemas, CMS content-editing payloads should keep
Page-level `bubbles[]` as the canonical Bubble location. Legacy nested
`panel.bubbles[]` is accepted by the writer and normalized into Page-level
Bubbles, but new CMS writes should use `Page.bubbles[]` with `bubble.panelId`
linking to the owning Panel. A client that starts from the admin GET payload
must not edit only `pages[].bubbles[]` while leaving stale
`pages[].panels[].bubbles[]` values in the same save payload. Either remove the
nested arrays before saving or keep both representations in sync, because the
writer still accepts legacy nested Bubbles for backward compatibility and
normalizes them into the canonical Page-level array.

Current API coverage for CMS content editing:

| CMS operation | Current API | Current write model | Future partial endpoint need |
| --- | --- | --- | --- |
| Series title / metadata / `publicationType` / `lifecycleStatus` | `PUT /admin/series/{id}` | Partial Series metadata patch; does not touch Episodes or Packs. | Not needed for MVP. |
| Episode title / publication settings / visibility | `POST /admin/series/{id}/episodes`, `PUT /admin/series/{id}/episodes/{epId}` | Full Episode replacement. CMS must preserve existing `pages[]` when changing metadata only. | Useful later for metadata-only writes with version checks. |
| Page structure and image metadata | Same Episode save routes | Full Episode replacement. CMS must preserve all other Pages. | Needed later for one-Page edits and conflict avoidance. |
| Panel bbox/order/status/flags | Same Episode save routes | Full Episode replacement. CMS must preserve all other Panels/Bubbles. | Needed later for one-Panel edits and review workflows. |
| Bubble bbox/order/source text/speaker/status/flags | Same Episode save routes | Full Episode replacement. `Bubble.textOriginal` remains canonical Japanese/source text. | Needed later for one-Bubble source text and bbox edits. |
| English translation import | `POST /admin/pack-drafts/{packDraftId}/translation-import` | Runtime Translation Pack Draft plan/apply; never overwrites canonical source text. | Existing route is enough for MVP import. Future entry update/delete may be needed. |
| Oneshot routing | Public/CMS clients read `publicationType: "oneshot"` and Episode list | No special write endpoint; still one Series with one primary Episode. | Optional future route helper for resolving the primary Episode. |

The main missing ergonomic surface is a future partial content-edit endpoint
for one Page/Panel/Bubble, useful for conflict avoidance in larger editorial
teams. The current file-backed MVP intentionally keeps the implemented write
path as full Episode replacement and should move runtime locks/version checks
to `packages/db` before multi-user production editing.

Next-phase partial content-editing API shape, design-level only:

| Future operation | Candidate endpoint | Mutable fields | Guard rails |
| --- | --- | --- | --- |
| Page update | `PATCH /admin/series/{id}/episodes/{epId}/pages/{pageId}` | `images`, `imageId`, `imageHash`, `width`, `height`, `displayRef`, `status`, `flags` | Must not rewrite unrelated Pages, Panels, or Bubbles. Image paths still use existing upload/delivery containment rules. |
| Panel bbox/order update | `PATCH /admin/series/{id}/episodes/{epId}/pages/{pageId}/panels/{panelId}` | `bbox`, `panelNumber`, `displayRef`, `status`, `flags`, `reactionTags` | Must validate the Panel belongs to the Page and keep linked Bubbles intact unless a move is explicitly requested. |
| Bubble source/text metadata update | `PATCH /admin/series/{id}/episodes/{epId}/pages/{pageId}/bubbles/{bubbleId}` | `bbox`, `panelId`, `bubbleNumber`, `displayRef`, `status`, `flags`, `textOriginal`, `speaker`, `bubbleType`, `textDirection`, `lang` | `textOriginal` is canonical source text only. Translation text must be rejected from this endpoint and routed to Translation Pack Draft import/adoption flows. |

Partial endpoints should return the normalized updated target plus enough
Episode revision metadata for CMS to refresh local state. Until those endpoints
exist, CMS should continue using full Episode replacement and treat the
response from `GET /admin/series/{id}/episodes/{epId}` as the source payload to
edit.

Canonical source text and translations remain separate:

- Canonical Japanese/original source text lives in `Bubble.textOriginal`.
- Translation import rows may carry `source_text` only for matching and
  `source_text_mismatch` warnings.
- English or other translated strings live in runtime Translation Pack Draft
  entries and later exported Pack manifests, never in canonical Episode JSON.
- Applying a Translation Pack Draft import must not change `Page.images`,
  `Panel`, `Bubble`, or `Bubble.textOriginal`.

Concurrent editing controls are not required for the single-operator
file-backed MVP, but they become required before any of these conditions:

- multiple CMS users can edit the same Episode at the same time
- autosave or long-lived Page Structure Review sessions are enabled
- translation import/adoption and structure edits can run concurrently
- API instances run on multiple hosts or share runtime state outside one local
  process

The expected contract for that phase is an Episode content revision returned by
admin reads and required on writes, either as an `ETag`/`If-Match` pair or an
explicit `expected_revision` field. Stale writes should fail with `409
CONTENT_VERSION_CONFLICT` and include the current revision so CMS can prompt
for reload/merge. Long-running edit locks should be runtime state with a TTL
and owner metadata; local file locks are only an implementation detail for
single-host writes and are not enough for production multi-user editing.

Feedback triage does not mutate canonical content or Packs. Status is limited
to `new`, `triaged`, or `closed`. Feedback can be converted into a private
Proposal Queue record through `/admin/feedback/{feedbackId}/proposal`. Only
`new` feedback can be converted, and the API rejects repeated conversion for
the same feedback record.

Proposal Queue records are runtime review state, not canonical content and not
published Packs. They are file-backed by default under `PROPOSALS_DIR` or
`proposals/`, and that directory is ignored by Git.

`POST /admin/proposals` creates a private Proposal Queue record and never
mutates canonical `contents/` or Pack manifests. Created proposals start with
`status: "new"`; review state changes must use
`PUT /admin/proposals/{proposalId}/status`. CMS Translation Workspace can post
Bubble-level translation drafts with:

- `series_id`
- `episode_id`
- `page_id`
- `panel_id`
- `bubble_id`
- `kind: "translation"`
- `source_text`
- `suggested_text`
- `comment`
- `lang`

For backward compatibility, `current_text` is still accepted as an alias for
`source_text`, and the API stores both when only one is supplied. Accepted
translation proposals remain in Proposal Queue until explicitly adopted into a
runtime Pack draft; there is no automatic Pack adoption, content write, or
GitHub handoff.

Reader feedback and Proposal Queue records may carry optional
`contributor_identity`. Missing identity is equivalent to:

```json
{ "identity_level": "anonymous" }
```

Supported identity levels are:

- `anonymous`: no claimed identity.
- `display_name`: unverified public display label.
- `github_login`: verified GitHub login identity with `github_login` and
  `verified: true`.

Anonymous and display-name identities must never directly create public GitHub
Issues or PRs. The safe default GitHub handoff mode is
`triage_issue_comment`, where a project bot appends reviewed queue items to a
daily or Episode-level triage Issue. `direct_issue` and `direct_pr` are
reserved for verified `github_login` contributors and are still only queued by
the current API skeleton.

Verified `github_login` identity can only be created by trusted server-side
paths:

- `POST /identity/github/oauth/callback` after server-side OAuth token exchange
  and GitHub user lookup are implemented.
- `POST /admin/identity/github/verifications` as a trusted admin/manual path.

The trusted admin route stores private runtime state in
`GITHUB_IDENTITY_DIR` or, if unset, `PROPOSALS_DIR`/`proposals/` as
`github-identity-verifications.jsonl`. Verification records have `active` or
`revoked` status. A verified record contains a reusable `contributor_identity`
with `identity_level: "github_login"` and `verified: true`.

GitHub handoff records are private runtime state, not GitHub artifacts. They
are file-backed by default in `GITHUB_HANDOFF_DIR` or, if unset,
`PROPOSALS_DIR`/`proposals/` as `github-handoffs.jsonl`. Creating a handoff
does not call the GitHub API. Status values are `queued`, `ready`, `sent`,
`failed`, and `canceled`; `sent` records can later store the resulting
`github_url` when a separate sync worker exists.

`POST /admin/github-handoffs/triage-draft` is an operator/export helper. It
selects queued `triage_issue_comment` handoff records, hydrates target
feedback/proposal context when available, and returns a GitHub-ready Markdown
title/body plus the included handoff IDs. It does not call GitHub and does not
change queue status. This is the bridge between safe private triage and a later
server-side GitHub App or cron sync worker with retry/backoff.

`POST /admin/github-handoffs/sync-dry-run` is the sync worker contract skeleton.
It selects `queued` and/or `ready` `triage_issue_comment` records, builds the
same triage draft, and returns a dry-run result without calling GitHub or
mutating queue state. The response includes:

- selected handoff IDs and skipped handoffs with reasons
- the generated `GitHubTriageDraft`
- required future configuration such as `GITHUB_APP_ID`/`GITHUB_TOKEN`,
  `GITHUB_INSTALLATION_ID`, `GITHUB_REPOSITORY`, and a triage Issue selection
  rule
- retry/backoff policy for network, 5xx, secondary-rate-limit, and rate-limit
  failures
- deduplication keys using `mode:triage_group_key:target_type:target_id`

Real posting remains out of scope until a GitHub App or token-backed worker is
implemented. That worker should persist sync attempts before posting, avoid
one GitHub artifact per anonymous/display-name submission, and only mark
handoffs `sent` after a GitHub URL is available.

The future sync worker should use separate runtime sync-attempt state rather
than extending canonical content. A sync attempt records the selected
`handoff_ids`, target repository, triage Issue target, idempotency key,
attempt count, last error, next retry time, GitHub rate-limit reset time, and
resulting GitHub URL when available. File-backed MVP state may live beside
`github-handoffs.jsonl` under `GITHUB_HANDOFF_DIR`; production should move this
state to `packages/db` before multi-worker or multi-host operation.

`POST /admin/github-handoffs/sync-attempts/planned` is the first persistence
skeleton for that worker. The request accepts the same filters as
`sync-dry-run` plus `target_repository` and either `target_issue_number` or
`issue_grouping_rule`. The API recomputes the dry-run result server-side,
rejects empty planned attempts, stores `status: planned`, and does not call
GitHub or mutate handoff status. The file-backed MVP stores records in
`github-handoff-sync-attempts.jsonl` under `GITHUB_HANDOFF_DIR`.

Planned attempts include `draft`, `draft_body_hash`, `handoff_ids`,
`dedupe_keys`, `retry_policy`, `attempt_count`, `max_attempts`,
`next_retry_at`, `rate_limit_reset_at`, and `idempotency_key`. If an active
`planned`, `in_progress`, or `retryable_failed` attempt already has the same
idempotency key, the route returns that existing attempt with `deduped: true`
instead of creating a duplicate.

`PUT /admin/github-handoffs/sync-attempts/{attemptId}/status` updates lifecycle
state only. Allowed target statuses are `in_progress`, `retryable_failed`,
`permanent_failed`, `canceled`, and `succeeded`. The body may set
`attempt_count`, `last_error`, `next_retry_at`, and `rate_limit_reset_at` so a
future worker can persist retry and rate-limit state without posting to GitHub.
`succeeded` additionally requires `github_url`; the route still does not call
GitHub and does not mark handoffs `sent`.

The worker execution contract is:

1. Select `planned` attempts whose `next_retry_at` is missing or in the past.
2. Claim exactly one attempt by moving it to `in_progress` and incrementing
   `attempt_count`.
3. Recompute the dry-run selection before any GitHub call. If the handoff set,
   draft hash, target repository, or triage Issue target no longer matches the
   attempt, stop with `permanent_failed` or create a fresh planned attempt.
4. Check credentials, repository target, triage Issue target, rate-limit state,
   idempotency key, and existing GitHub metadata before posting.
5. After a future successful GitHub response, set attempt `succeeded` with
   `github_url`, then mark included handoffs `sent` with the same URL.

The CMS should expose the preflight checklist on each sync attempt before any
future posting worker is enabled. The checklist is operator-visible state only
and must not call GitHub: target repository, target Issue or grouping rule,
idempotency key, included handoffs, identity level metadata from the draft body,
and the recorded rate-limit state.

`retryable_failed` is for network errors, GitHub 5xx, 429, secondary rate
limits, and explicit retry-after/rate-limit reset responses. It must include
`last_error`, `next_retry_at`, and `rate_limit_reset_at` when available.
`permanent_failed` is for invalid configuration, missing credentials, 401/403
permission failures, missing repository or Issue targets, stale draft content,
or identity/mode violations. `canceled` is operator-driven and must not be
picked up by workers. `succeeded` must only be written after a durable GitHub
URL is known.

Retry and dedupe are part of the worker contract. The worker should acquire a
per-triage-group lock, recompute the same dry-run result immediately before
posting, and skip handoffs that already have `sent` status or an in-flight
attempt with the same idempotency key. Retryable failures are network errors,
GitHub 5xx, secondary rate limits, and 429 responses; the worker should use
bounded exponential backoff with jitter and honor GitHub rate-limit reset
headers when present. Validation failures, missing credentials, permission
errors, and not-found repository or Issue targets should become permanent
operator-visible failures rather than tight retry loops.

Identity rules do not change for sync. Anonymous and display-name handoffs are
always bot-authored triage Issue comments, with display names labeled
unverified. Verified `github_login` handoffs may include the verified login in
the triage body, but direct Issue/PR posting remains a later explicit workflow
and must still require `identity_level: "github_login"` with `verified: true`.

File-backed Proposal Queue writes use a local lock around create and
read-modify-write status changes. This reduces lost updates in local and small
single-host deployments, but it is not a substitute for moving runtime review
state to `packages/db` before multi-host production operation.

Proposal kinds:

- `translation`
- `typo`
- `footnote`
- `commentary`
- `tag`
- `structure`

Proposal statuses:

- `new`
- `triaged`
- `accepted`
- `rejected`
- `closed`

Accepting a proposal records reviewer intent only. Adoption into canonical
Episode JSON or a Pack remains a later explicit workflow.

### Pack Manager State

Pack Manager has two separate layers:

- Runtime Pack drafts are CMS review state. They live under `PACK_DRAFTS_DIR`
  or `pack-drafts/` by default, are ignored by Git, and are exposed only through
  admin routes.
- Canonical Pack manifests live under `packs/{packId}/pack.json`. They are
  source-controlled product assets and are validated by
  `packages/schemas/src/content.ts`.

Runtime Pack draft create, update, and adoption routes do not write `contents/`
or canonical `packs/`. The explicit boundary is
`POST /admin/pack-drafts/{packDraftId}/export`, which writes
`packs/{packId}/pack.json` from an `approved` or `published` Pack draft with at
least one entry. `pack_id` must be a safe path segment. Existing canonical Packs
are not overwritten unless `overwrite: true` is supplied.

File-backed Pack draft writes use the same local lock strategy around create,
status updates, and proposal adoption. This prevents most accidental local
lost-update cases while the MVP remains file-backed.

If export sets `is_published: true`, the generated manifest has
`isPublished: true` and defaults to `packClass: official` unless a pack class is
provided. The API also moves the runtime Pack draft to `published` review state.
This still does not mutate canonical Episode JSON.

Public Reader availability reads canonical Pack manifests from `PACKS_DIR` or
`packs/` by default. Only `isPublished: true` manifests are eligible, and
`packClass: deprecated` manifests are excluded. The API filters entries to the
requested Series/Episode/Page/Panel/Bubble before adding them to
`availablePacks`.

Pack types:

- `TRANSLATION`
- `FOOTNOTE`
- `COMMENTARY`
- `LEARNING`
- `ACCESSIBILITY`

Pack draft statuses:

- `draft`
- `in_review`
- `approved`
- `published`
- `archived`

Accepted Proposal Queue records can be adopted into Pack drafts:

- `translation` and `typo` proposals can be adopted into `TRANSLATION` drafts.
- `footnote` proposals can be adopted into `FOOTNOTE` drafts.
- `commentary` and `tag` proposals can be adopted into `COMMENTARY` or
  `LEARNING` drafts.
- `structure` proposals can be adopted into `ACCESSIBILITY` drafts.

Only `accepted` proposals can be adopted. Adoption adds a Pack draft entry with
the proposal target and suggested text, but it does not mutate the source
Proposal record, canonical Episode JSON, or published Pack manifests. The same
proposal cannot be adopted into the same Pack draft twice. Cross-draft adoption
is allowed for now because some Proposal kinds can legitimately feed multiple
Pack types; CMS surfaces existing adoptions so reviewers can avoid accidental
duplicates.

### Translation Pack Draft Import

`POST /admin/pack-drafts/{packDraftId}/translation-import` is the CMS import
contract for English or other target-language translation rows. It is a
runtime Pack Draft operation and never writes canonical Episode JSON,
duplicates a Series, exports `packs/`, or posts to GitHub.

Machine-assisted translation should use this same import contract as its Pack
Draft entry point. See [translation-pipeline-spec.md](translation-pipeline-spec.md)
for the design-level staged pipeline and origin metadata boundary.

Request body:

```json
{
  "series_id": "oumaga-dokidoki",
  "episode_id": "ep01",
  "lang": "en",
  "source_format": "csv",
  "apply": false,
  "entries": [
    {
      "bubble_id": "oumaga-dokidoki-ep01-p01-bubble-001",
      "source_text": "日本語の原文",
      "text": "English translation",
      "row_number": 2
    }
  ]
}
```

CMS may parse CSV client-side or server-side, but the API contract receives
normalized rows in `entries[]`. `source_format` records whether the operator
import originated as `csv` or `json`; it does not change validation rules.
`text` is the canonical imported translation field, while `suggested_text` is
accepted as an alias for clients that already use Proposal Queue naming.

The route always compares imported `bubble_id` values against the target
Episode's canonical `Page.bubbles[]`:

- `unmatched_bubble` is an error when an import row references a Bubble ID not
  found in the Episode.
- `duplicate_bubble` is an error when the import contains more than one row
  for the same Bubble ID.
- `existing_entry_conflict` is an error when the Pack draft already has an
  entry for the same Series/Episode/Page/Panel/Bubble/lang.
- `missing_bubble` is a warning when an active canonical Bubble has no import
  row. This lets CMS show incomplete translation coverage without blocking
  partial draft imports.
- `source_text_mismatch` is a warning when the supplied source text differs
  from canonical `Bubble.textOriginal`.

When `apply: false` or omitted, the API returns `{ applied: false, result }`
with summary counts, issues, and `planned_entries` but does not mutate the Pack
draft. When `apply: true`, the API writes all `planned_entries` atomically to
the runtime Pack draft only if there are no error issues and at least one
planned entry. Error issues return 400 with the same `result` payload.

CMS caller alignment:

- `apps/cms` resolves CSV/JSON rows to canonical `bubble_id` values before
  calling the API. The API still revalidates every Bubble ID against the target
  Episode and must be treated as the source of truth for match results.
- CMS sends `series_id`, `episode_id`, `lang`, `source_format`, `entries[]`,
  and optional `apply`, matching `TranslationPackDraftImportInput`.
- CMS can display validation failures from either a 200 preview response or a
  400 apply response because blocking apply failures still include
  `{ applied: false, result }`.
- CMS should use `result.can_apply` rather than local row counts to enable the
  apply action. `can_apply` is false when there are blocking errors or no
  planned entries.
- CMS may create a `TRANSLATION` Pack draft before import with
  `target_series_id`, `target_episode_id`, and `language` set to the import
  language. The import route also validates that a selected draft is compatible
  with the requested Series/Episode/lang target.

Imported entries use the canonical Bubble target from the Episode, not
operator-supplied `page_id` or `panel_id`, so stale CSV/JSON page references
cannot retarget translations silently. The Pack draft entry stores the target
language in `lang`, canonical original text in `original_text`, imported
translation in `text`, and row provenance under
`metadata.source: "translation_import"`.

### Rights And Permission State

Rights/Role Manager is a runtime governance layer. It is separate from reader
entitlements:

- Entitlement answers whether a user can read gated content.
- Rights grants answer whether a user can propose, edit, review, publish, or
  commercially use content or Packs.

The initial contract is defined by `packages/domain/src/rights-types.ts`,
`packages/domain/src/rights-repository.ts`, `packages/schemas/src/rights.ts`,
and the `Rights*` component schemas in `openapi.yaml`.

Rights grants are DB-backed when `DATABASE_URL` is configured, using
`packages/db` runtime state. Local/no-DB development falls back to file-backed
storage under `RIGHTS_DIR` or `rights/`, and that directory is ignored by Git.
The current admin API supports list, create, revoke, and explicit permission
checks. These APIs do not grant reading entitlement, do not publish Packs, and
do not mutate canonical content.

The subject identifier is provider-neutral: grants target `subject_user_id`,
not email, GitHub login, Stripe customer, or another provider-specific account
key. Login providers may map to a stable `subject_user_id`, but permission
checks only consume the resolved user ID.

Revoke audit is part of the Rights grant record. `POST
/admin/rights/grants/{grantId}/revoke` sets `revoked_at` and `revoked_by` in
the same update, where `revoked_by` is the authenticated operator's stable user
ID. File-backed and DB-backed repositories must preserve the same fields.

Rights roles:

- `owner`
- `editor`
- `translator`
- `reviewer`
- `contributor`
- `moderator`
- `viewer`
- `original_rights_holder`
- `translation_reviewer`
- `footnote_contributor`
- `pack_maintainer`
- `publisher`

Rights permissions:

- `propose_translation`
- `propose_footnote`
- `edit_structure`
- `edit_translation`
- `review_translation`
- `review_footnote`
- `approve_translation`
- `approve_footnote`
- `publish_pack`
- `manage_rights`
- `moderate_proposals`
- `commercial_use`

Grant scope can include `series_id`, `episode_id`, `language`, `pack_id`,
`usage`, and `territory`. Language-specific grants do not imply all-language
grants. Pack-specific grants do not imply original-content rights. Commercial
use requires an explicit `commercial_use` permission and matching usage scope.

A grant scope field acts as a restriction when present. For example, a grant
with `language: "en"` matches English checks only; a grant with no `language`
field is an all-language grant and should be used deliberately.
If a grant has a `usage` restriction, permission checks must provide a matching
`usage` array.

Current Series list filtering checks grants per Series. This is acceptable for
the small MVP dataset. A later optimization should load the authenticated
user's active grants once and evaluate all manageable Series from that in-memory
grant set.

### Image Upload And Storage State

Current image handling is path-based:

- Canonical Episode JSON stores Page image references as locale-keyed relative
  paths under `contents/{seriesId}/{episodeId}/`, for example
  `pages/p01.jpg`.
- CMS admin preview reads those existing files through
  `/admin/series/{id}/episodes/{epId}/pages/{pageNumber}/image?locale=ja`.
- Public reader payloads replace origin paths with short-lived delivery URLs.
  Newly generated delivery URLs use `/deliver/{pageId}?lang={locale}&token=...`.
  The delivery route also accepts the legacy `locale` query name.
- Page OGP metadata should use the stable `/og/page/{pageId}` facade. The OGP
  route redirects through tokenized delivery and does not expose raw origin
  paths. MVP behavior is limited to public free Episode pages.
- Admin Page image upload accepts either `multipart/form-data` with a `file`
  field or direct `image/*` binary for JPEG, PNG, WebP, and GIF.
- Uploads are stored under
  `contents/{seriesId}/{episodeId}/pages/p{pageNumber}.{locale}.{ext}` and
  replace `Episode.pages[].images[locale]`.
- Uploads overwrite the same page/locale path. Default size limit is 10 MiB and
  can be changed with `MAX_IMAGE_UPLOAD_BYTES`.
- Upload responses include `imagePath`, `contentType`, `size`, and `sha256`.

## Ingestion Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/admin/ingestion/jobs` | Create ingestion job |
| `GET` | `/admin/ingestion/jobs` | List ingestion jobs |
| `GET` | `/admin/ingestion/jobs/{jobId}` | Read ingestion job detail and draft |
| `GET` | `/admin/ingestion/jobs/{jobId}/review-candidates` | Read Page / Panel / Bubble candidates for CMS review |
| `PUT` | `/admin/ingestion/jobs/{jobId}/review-decisions` | Persist one candidate accept/reject decision |
| `POST` | `/admin/ingestion/jobs/{jobId}/write-reviewed-draft` | Replace the draft with accepted candidates only |
| `PUT` | `/admin/ingestion/jobs/{jobId}/draft` | Update draft payload |
| `POST` | `/admin/ingestion/jobs/{jobId}/submit` | Submit draft for review |
| `POST` | `/admin/ingestion/jobs/{jobId}/confirm` | Confirm draft into `contents/` |
| `POST` | `/admin/ingestion/jobs/{jobId}/cancel` | Cancel ingestion job |
| `POST` | `/admin/ingestion/import/prepared-directory` | Copy prepared local Page images into draft asset storage and create an ingestion draft job |

Ingestion draft state is not the same as canonical content state. A draft enters
canonical content only after confirmation writes to `contents/`.

Prepared directory imports read from the API server `IMPORTS_DIR`, copy images
to draft asset storage, and store canonical target paths such as
`pages/p001.png` in the draft. The draft may also carry `sourceImagePath`,
which is copied into `contents/{seriesId}/{episodeId}/` only when the job is
confirmed.

Review decisions are stored on the ingestion draft as optional
`reviewDecisions`. `write-reviewed-draft` requires all candidates to be either
accepted or rejected, removes rejected candidates, renumbers accepted
Panel/Bubble structures, and keeps the remaining candidates marked accepted in
the draft before confirmation.
If `confirm` is called while review decisions still exist, the API applies the
same accepted-only filter before writing to `contents/`.

### Import Draft Shapes

Import-specific drafts may exist before canonical `DraftPayload` data. For PSD
and PSB text-layer intake, the shared minimal shape is:

```ts
interface ImportDetectionMetadata {
  ocrConfidence?: number;
  detectionConfidence?: number;
  textCenter?: { x: number; y: number };
  detectorRunId?: string;
  sourceDetector?: string;
  sourceArtifactIds?: string[];
}

interface ImportedBubbleDraft {
  stableRef: string;
  source: "psd_text_layer";
  textOriginal: string;
  layerName: string;
  groupPath: string[];
  visible: boolean;
  bbox?: BoundingBox;
  bubbleType?: BubbleType;
  speaker?: string;
  speakerConfidence?: SpeakerConfidence;
  textDirection?: TextDirection;
  lang?: string;
  sourceLayerId?: string;
  detectionMetadata?: ImportDetectionMetadata;
  notes?: string[];
}

interface PageImportResult {
  sourceFile: string;
  parser: string;
  parserVersion?: string;
  pageNumber?: number;
  displayRef?: string;
  width?: number;
  height?: number;
  detectionMetadata?: ImportDetectionMetadata;
  bubbles: ImportedBubbleDraft[];
  warnings: string[];
  unsupported: string[];
}
```

The canonical TypeScript definitions live in
`packages/domain/src/ingestion-types.ts`. The canonical Zod schemas live in
`packages/schemas/src/import-result.ts` and are exported from `@manga/schemas`
as `ImportedBubbleDraftSchema` and `PageImportResultSchema`. Ingestion
adapters should import these shared schemas instead of defining local
incompatible copies.

`stableRef` is a draft identity for review workflows. It must not be generated
from array index or traversal order. PSD/PSB import should prefer a source layer
ID when the parser exposes one, and otherwise use deterministic source metadata
such as file path, group path, layer name, text, and bounds.

`PageImportResult` is not canonical content. It does not infer Panel membership
and does not write to `contents/` without a later CMS review/confirmation step.
`detectionMetadata` is also draft-only. It exists so ingestion artifacts and CMS
review payloads can keep OCR confidence, detection confidence, OCR text center,
detector run/source information, and source artifact ids without promoting those
fields to canonical `Page`, `Panel`, or `Bubble` data. `speakerConfidence`
remains separate and only describes confidence in speaker attribution.

## Auth, Entitlement, Purchase, And Redeem Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/dev-login` | Development login |
| `POST` | `/auth/login` | Magic-link login request |
| `GET` | `/auth/verify` | Magic-link verification |
| `GET` | `/auth/me` | Current user |
| `POST` | `/admin/entitlements/grant` | Grant entitlement |
| `GET` | `/entitlements/check` | Check current entitlement |
| `GET` | `/admin/entitlements/list` | List entitlements |
| `POST` | `/admin/entitlements/revoke` | Revoke entitlement |
| `POST` | `/admin/api-keys` | Create API key |
| `GET` | `/admin/api-keys` | List API keys |
| `POST` | `/admin/api-keys/{id}/revoke` | Revoke API key |
| `POST` | `/admin/purchases` | Create purchase record |
| `GET` | `/admin/purchases` | List purchase records |
| `POST` | `/admin/auth/cleanup` | Cleanup auth tokens |
| `POST` | `/redeem` | Redeem code |

These routes are runtime state routes. Their persisted state belongs in
`packages/db` when `DATABASE_URL` is set, or file-backed repositories where
implemented.

## Response Shape Rules

Use JSON for all API responses.

Error responses should follow:

```ts
interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
```

Collection responses should use `items` unless `openapi.yaml` specifies a more
specific envelope:

```ts
interface ListResponse<T> {
  items: T[];
  nextCursor?: string;
}
```

Do not introduce UI-only field names into API responses when a canonical domain
field already exists. For example, use `seriesId` / `episodeId`, not
`mangaId` / `chapterId`.

## Versioning And Compatibility

- API base path is `/api/v1`.
- Breaking API changes require an `openapi.yaml` update in the same branch.
- Shared type changes require matching Zod schema changes when runtime content
  validation is affected.
- UI branches may add local adapter types, but those adapters must map to the
  canonical contract and should be removed or narrowed during integration.
- Public reader routes must preserve existing deep-link paths unless a migration
  plan is documented.

## Parallel Work Rules

During parallel work, only the API / CMS Core thread should edit the shared
contract files:

- `openapi.yaml`
- `docs/api-contract.md`
- `packages/domain/src/types.ts`
- `packages/schemas/src/content.ts`
- `packages/domain/src/content-loader.ts`
- `packages/domain/src/content-writer.ts`
- `packages/db/prisma/schema.prisma`

CMS and Viewer threads should treat those files as read-only. If they need a
contract change, they should report the required change and continue with a
clearly isolated adapter or mock.
