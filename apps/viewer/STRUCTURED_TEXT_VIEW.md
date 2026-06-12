# Structured Text View

The Viewer exposes an optional read-aloud / accessibility HTML view at:

```text
/works/{seriesId}/episodes/{episodeId}/text
```

This route is disabled by default and returns 404 unless the deployment enables
it through a server-side allow-list. It uses the same public/free Episode gate
as the image Reader: API-backed deployments must return a published, ungated
Episode; local fallback only exposes the same free Episode behavior as the
Reader.

The route renders semantic HTML in this order:

```text
Page -> Panel -> Bubble
```

Each Bubble includes its `speaker` when present, a human label for
`bubbleType`, and the canonical `Bubble.textOriginal` value. Translation Pack
text is intentionally not rendered in this MVP, so `?lang=en` still shows the
canonical source text until Pack text support is added in a later phase.

## Opt-in Policy

The route follows the text exposure policy in
`docs/reader-text-layer-spec.md`: public Bubble text is useful for
accessibility, but it increases scraping and indexing surface, so it must be
explicitly enabled.

Viewer MVP uses server-side allow-list env vars only:

```text
READER_TEXT_VIEW_SERIES=series-id
READER_TEXT_VIEW_EPISODES=series-id/episode-id,other-series:ep01
```

These env vars are server-side only and default to empty.

Content metadata opt-in should wait for an explicit contract update across
`packages/schemas`, `packages/domain`, and `docs/api-contract.md`. Until then,
do not document or rely on ad hoc `metadata.textExposure` keys.

## Indexing

The structured text route always emits:

```html
<meta name="robots" content="noindex,follow">
```

It is not included in `sitemap.xml`. This prevents duplicate body-text indexing
while still allowing readers and assistive technology to use the page directly.
