# Migration Note — Viewer Architecture

This document describes the current viewer implementation and the path forward
for connecting to the production delivery stack.

## Current State (MVP)

| Aspect | Status |
|--------|--------|
| Output mode | `static` (Astro 5 default) — pages opt into SSR with `prerender = false` |
| Data source | `src/data/mock.ts` — hardcoded mock data |
| Domain types | Imported from `@manga/domain` (shared monorepo package) |
| Image delivery | Placeholder SVGs served from `/public` |
| Auth / Entitlement | Not implemented |
| Locale | `BaseLayout` accepts `locale` prop, defaults to `ja` |

### Rendering modes by page

| Page | Mode | Reason |
|------|------|--------|
| `/` (Home) | Prerender | Static content |
| `/works` (Works Index) | Prerender | Static content |
| `/works/[workId]` (Work Detail) | Prerender | Static content |
| `/works/[workId]/episodes/[episodeId]` | **SSR** | Entitlement gating required |
| `/quote/[...slug]` | **SSR** | Avoid O(bubbles) build |
| `/clip/[...slug]` | **SSR** | Avoid O(panels) build |
| `/reaction/[tag]` | **SSR** | Avoid O(tags) build |

## Migration Path

### Step 1: Connect to @manga/api

Replace mock data imports in `src/data/mock.ts` with fetch calls:

```typescript
// Before (mock)
import { series } from "./mock";

// After (API)
const res = await fetch(`${API_BASE}/series/${seriesId}/episodes/${episodeId}/pages/${pageNumber}`);
const data: ReaderPageResponse = await res.json();
```

The API returns `PageImageSet` with delivery URLs, not origin URLs.

### Step 2: Add entitlement gating to episode page

The episode page (`[episodeId].astro`) is already SSR. When connecting to the API:

1. Forward the user's auth token to the API
2. The API checks entitlement and returns either full page data or a gated response
3. If gated: show preview UI with purchase/redeem CTA
4. If allowed: render with delivery URLs from `images` field

### Step 3: Use delivery URLs for images

```astro
<!-- Current: mock placeholder -->
<img src={page.images.ja ?? "/placeholder-page.svg"} />

<!-- Production: delivery URL from API -->
<img src={page.images.ja} />
<!-- page.images.ja = "/api/v1/deliver/{pageId}?lang=ja&token=..." -->
```

The viewer never constructs delivery URLs itself — the API provides them.

### Step 4: Add reader component

Replace the current vertical scroll with an Astro island:

- Client-side JS for page navigation, panel highlight, bubble selection
- Fragment navigation (#pN) for deep linking
- Pack overlay toggling

### Step 5: Add SSR adapter for deployment

```bash
npx astro add cloudflare  # or node, vercel, etc.
```

## Where things go

| Concept | Current location | Future source |
|---------|-----------------|---------------|
| Domain types | `@manga/domain` | `@manga/domain` (no change) |
| Mock data | `src/data/mock.ts` | API calls to `@manga/api` |
| Reader rendering | `[episodeId].astro` (vertical scroll) | Astro island with reader physics |
| Overlay translations | Not implemented | Pack overlay component |
| Quote / Clip sharing | SSR pages with mock data | SSR pages with API data + OGP images |
| Reaction search | SSR page with mock data | API-backed search with image previews |
| Image delivery | Placeholder SVGs | `/deliver/{pageId}` endpoint with watermark |
| Entitlement | Not implemented | API middleware + viewer gating UI |
