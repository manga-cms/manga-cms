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

### Series

Canonical TypeScript shape:

```ts
type SeriesStatus = "ongoing" | "completed" | "hiatus";

interface Series {
  id: string;
  title: string;
  description: string;
  status: SeriesStatus;
  coverUrl: string;
  episodes: Episode[];
}
```

Storage manifest: `contents/{seriesId}/series.json`

```ts
interface SeriesManifest {
  id: string;
  title: string;
  description: string;
  status: SeriesStatus;
  cover: string;
  episodes: string[];
}
```

### Episode

Canonical TypeScript shape:

```ts
interface Episode {
  id: string;
  episodeNumber: number;
  title: string;
  publishedAt: string;
  pages: Page[];
}
```

Storage file: `contents/{seriesId}/{episodeId}/episode.json`

`publishedAt` is required in the current schema. Draft and review state exists
in ingestion jobs, not as a canonical Episode status field.

### Page

Canonical TypeScript shape:

```ts
interface Page {
  id: string;
  pageNumber: number;
  images: Record<string, string | undefined>;
  width: number;
  height: number;
  displayRef?: string;
  flags?: ContentFlags;
  panels: Panel[];
}
```

Rules:

- `pageNumber` is 1-based.
- `images` is keyed by locale such as `ja` or `en`.
- Public reader responses should use delivery URLs, not raw origin paths, when
  image entitlement or tokenization is relevant.
- Admin image endpoints may expose controlled preview paths for authenticated
  CMS editing.

### Panel

Canonical TypeScript shape:

```ts
interface Panel {
  id: string;
  panelNumber: number;
  bbox: BoundingBox;
  reactionTags: string[];
  flags?: ContentFlags;
  bubbles: Bubble[];
}
```

Rules:

- `panelNumber` is 1-based within a Page.
- `bbox` is stored in page coordinate space.
- `reactionTags` supports official reaction search and should not be treated as
  an unrestricted public tagging system.

### Bubble

Canonical TypeScript shape:

```ts
type BubbleType = "speech" | "thought" | "narration" | "sfx" | "caption" | "other";
type TextDirection = "horizontal" | "vertical";
type SpeakerConfidence = "confirmed" | "inferred" | "unknown";

interface Bubble {
  id: string;
  bubbleNumber: number;
  shortId: string;
  bubbleType: BubbleType;
  textOriginal: string;
  speaker?: string;
  speakerConfidence?: SpeakerConfidence;
  textDirection?: TextDirection;
  lang?: string;
  flags?: ContentFlags;
  bbox: BoundingBox;
}
```

Rules:

- `bubbleNumber` is 1-based within a Panel.
- `shortId` is a display/share helper, not a replacement for stable `id`.
- Speaker metadata is optional until editorial confidence is available.

### Shared Supporting Types

```ts
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ContentFlags {
  shareable: boolean;
  feedback_enabled: boolean;
  contains_spoiler?: boolean;
}
```

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
| `GET` | `/deliver/{pageId}` | Token-verified image delivery |

Public reader endpoints must be safe for unauthenticated requests unless the
route explicitly accepts optional auth. Entitlement-gated content must return a
gated response or omit protected image URLs rather than leaking origin paths.

Current CMS/Reader endpoint coverage:

- CMS uses `/series`, `/series/{id}`, `/admin/series`,
  `/admin/series/{id}`, `/admin/series/{id}/episodes`,
  `/admin/series/{id}/episodes/{epId}`,
  `/admin/series/{id}/episodes/{epId}/pages/{pageNumber}/image`,
  `/admin/series/{id}/publish`, ingestion routes, auth routes, and entitlement
  admin routes. These are implemented by `apps/api`.
- Reader SSR uses `/series/{seriesId}/episodes/{episodeId}`, `/quotes/...`,
  `/clips/...`, `/reactions`, `/feedback`, and tokenized `/deliver/{pageId}`.
  These are implemented by `apps/api`.
- `/packs/{packId}`, proposal review routes, and public proposal listing are
  not implemented in `apps/api` and are not part of the current core contract.
  Reintroduce them in `openapi.yaml` only when the implementation exists or a
  task explicitly schedules that surface.

## CMS Admin Endpoints

Base path: `/api/v1`

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/admin/series` | Create Series |
| `PUT` | `/admin/series/{id}` | Update Series metadata |
| `POST` | `/admin/series/{id}/episodes` | Create or save Episode |
| `PUT` | `/admin/series/{id}/episodes/{epId}` | Update Episode |
| `GET` | `/admin/series/{id}/episodes/{epId}` | Read full Episode for CMS editing |
| `GET` | `/admin/series/{id}/episodes/{epId}/pages/{pageNumber}/image` | Read admin Page image preview |
| `POST` | `/admin/series/{id}/publish` | Reload/publish Series data |

Admin endpoints require authenticated admin access. Browser CMS calls should
send credentials so the `manga_auth` cookie is included.

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
- `ContentWriteRepository` writes JSON metadata and validates Series/Episode
  identifiers plus stored asset paths, but it does not copy or persist binary
  image uploads.

Current gap:

- There is no multipart or direct binary upload endpoint for Page images.
  A future upload API needs to define accepted MIME types, per-series storage
  location, overwrite behavior, size limits, checksum behavior, and whether the
  API or CMS creates the final `pages/*.jpg|png|webp` relative path.

## Ingestion Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/admin/ingestion/jobs` | Create ingestion job |
| `GET` | `/admin/ingestion/jobs` | List ingestion jobs |
| `GET` | `/admin/ingestion/jobs/{jobId}` | Read ingestion job detail and draft |
| `PUT` | `/admin/ingestion/jobs/{jobId}/draft` | Update draft payload |
| `POST` | `/admin/ingestion/jobs/{jobId}/submit` | Submit draft for review |
| `POST` | `/admin/ingestion/jobs/{jobId}/confirm` | Confirm draft into `contents/` |
| `POST` | `/admin/ingestion/jobs/{jobId}/cancel` | Cancel ingestion job |

Ingestion draft state is not the same as canonical content state. A draft enters
canonical content only after confirmation writes to `contents/`.

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
