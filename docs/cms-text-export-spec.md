# CMS Text Export Spec

This document defines a design-level plan for exporting canonical Series / Episode text from Creator CMS. It is not an implemented API contract yet.

## Purpose

Editors need a fast way to review all source text in an Episode without opening each Bubble in Structure Review. The export should support proofreading, translation handoff, script review, accessibility preparation, and archive review.

The canonical source for exported manga text is `Bubble.textOriginal` in the Episode content model.

```text
Episode -> Page -> Bubble.textOriginal
```

Panel information is context, not a hard requirement. Export must not assume
that every Bubble is physically nested under `Page.panels[].bubbles[]`. A Bubble
may be present at page level, may have a missing/null Panel reference, or may
belong to a Panel that cannot be resolved yet. When a Bubble has a resolvable
`panelId` / `panelRef`, export may group it under that Panel for readability.
The export algorithm should still be Bubble-first.

Translation Pack Draft text must not be treated as canonical source text. Translation export is a separate future feature.

## MVP Scope

Add a CMS-only export action from an Episode-level screen, preferably both:

- Episode Editor
- Page Structure Review

The MVP can run entirely client-side after CMS loads the full admin Episode payload from:

```text
GET /api/v1/admin/series/{seriesId}/episodes/{episodeId}
```

No API route is required for the first implementation. The browser can generate and download text files from the already-loaded Episode object.

## Export Formats

### Markdown

Primary human-readable format.

Use for proofreading, sharing with collaborators, and quick review.

```md
# {Series title} / {Episode title}

## p02

### p02-k03
- p02-k03-f01: 「...」

### p02-k04
- p02-k04-f02: 「...」
- p02-k04-f03: 太郎: [textOriginal未入力]
```

Rules:

- Sort Pages by `pageNumber`, then `displayRef`, then `id`.
- Sort Panels by `panelNumber`, then `displayRef`, then `id`.
- Sort Bubbles by `readingOrder`, then `bubbleNumber`, then `displayRef`, then
  `id`.
- Missing numeric ordering fields sort after defined values. String fallback
  fields use empty string when missing, with `id` as the final fallback.
- Use `displayRef` as the primary visible reference where available. Fall back
  to `shortId`, then `id`.
- Group Bubbles under Panel headings only when the Panel reference can be
  resolved. If a Bubble has no resolved Panel, place it under a page-level
  `### Panel未設定` section. Bubbles under `Panel未設定` use the same Bubble
  sorting rules. Place `Panel未設定` after all resolved Panel sections within
  the Page.
- Include speaker only when it is set and not speakerless.
- Format speaker text as `speaker「textOriginal」`.
- Format speakerless text as `「textOriginal」`.
- If a Page has no Bubbles at all, show `テキストなし`.
- If a Bubble exists but `textOriginal` is empty/null, include the Bubble row
  and render `[textOriginal未入力]`.
- If `textOriginal` is empty/null and speaker is set, render
  `speaker: [textOriginal未入力]`. Do not wrap the placeholder in Japanese
  quotation marks.
- If a Panel has no Bubbles, omit the Panel in MVP.

### TSV

Primary machine-friendly proofreading / spreadsheet format.

Recommended columns:

```text
series_id
episode_id
page_id
panel_id
bubble_id
page_display_ref
panel_display_ref
bubble_display_ref
bubble_short_id
page_number
panel_number
bubble_number
reading_order
speaker
text_direction
bubble_type
text_original
```

Rules:

- Use UTF-8.
- Keep one Bubble per row.
- For TSV MVP, escape tabs and line breaks inside field values so rows remain
  stable across spreadsheet tools:
  - Replace actual tab characters with the two-character sequence `\t`.
  - Replace CRLF / LF line breaks with the two-character sequence `\n`.
- TSV export is review-oriented and is not intended to be a lossless import
  format in MVP. JSON is the future import-friendly format.
- Keep machine IDs and human refs separate: use `page_id`, `panel_id`,
  `bubble_id` for machines, and `page_display_ref`, `panel_display_ref`,
  `bubble_display_ref`, and `bubble_short_id` for editors.
- Do not include private admin notes, feedback records, runtime proposal IDs, or Pack draft IDs.

### JSON

Future import-friendly format.

```json
{
  "seriesId": "...",
  "episodeId": "...",
  "exportedAt": "...",
  "schema": "manga-cms.text-export.v1",
  "bubbles": [
    {
      "pageId": "...",
      "panelId": null,
      "bubbleId": "...",
      "displayRef": "p02-k03-f01",
      "readingOrder": 1,
      "speaker": "...",
      "textDirection": "vertical",
      "bubbleType": "speech",
      "textOriginal": "..."
    }
  ]
}
```

JSON export can be implemented after Markdown and TSV unless an import workflow needs it sooner.
In JSON export, `panelId` may be `null` when the Bubble has no resolved Panel.

## UI Design

Add a small export menu rather than multiple permanent buttons.

Suggested placement:

- Episode Editor header: `Text export`
- Page Structure Review header: `Text export`

Menu actions:

- `Markdownを書き出す`
- `TSVを書き出す`
- `JSONを書き出す` (optional / later)
- `クリップボードにコピー` (Markdown, optional)

The action should not save the Episode. It should export the current in-memory Episode state so editors can review unsaved changes before committing, but the UI must clearly label this when there are unsaved edits.

Before export, all pending editor field values must be flushed into the same
in-memory Episode draft state used for saving. If a form keeps local component
state, debounced input state, or blur-only field updates, the export action must
read the save-ready draft state rather than stale props.

Suggested warning when dirty:

```text
未保存の編集内容を含めて書き出します。
```

Suggested dirty filename suffix:

```text
{episodeId}_text-export_unsaved_{YYYYMMDD-HHMM}.{ext}
```

Suggested clean filename:

```text
{episodeId}_text-export_{YYYYMMDD-HHMM}.{ext}
```

## Empty Text Handling

For Reader-facing UI, hiding missing text is acceptable. For CMS export, missing text should be visible because it is a quality control signal.

Markdown:

- Page with no Bubble objects: `テキストなし`.
- Existing Bubble with empty/null `textOriginal`: `[textOriginal未入力]`.
- Panel with no Bubble text: omit the Panel unless a `verbose` option is later added.

TSV/JSON:

- Include existing Bubbles by default, even when `textOriginal` is empty.
- Do not synthesize Bubble rows for empty Panels in MVP.

## Speaker Handling

Export should not invent speakers.

- For Markdown speaker rendering, treat `undefined`, `null`, empty string, and
  case-insensitive `"unknown"` as speakerless.
- If `speaker` is set and not speakerless, render `speaker「textOriginal」`.
- If `speaker` is speakerless, render `「textOriginal」`.
- Do not localize, normalize, or infer speaker names during export.
- TSV/JSON should preserve the raw speaker value in its own field.

## Security And Rights

Text export is an admin-only CMS operation. It may include unpublished content and therefore must not be added to Public Viewer.

Do not include:

- image delivery URLs or raw filesystem paths
- feedback private comments
- contributor identity data
- runtime proposal IDs
- Pack draft private metadata
- entitlements or purchase data

## Future Server-Side Export

A future API route may be useful when exports need audit logs, large episodes, bulk Series export, or background jobs:

```text
GET /api/v1/admin/series/{seriesId}/episodes/{episodeId}/text-export?format=markdown|tsv|json
```

This route is not part of the current executable contract. If implemented later:

- Add it to `openapi.yaml`.
- Add response schemas to `packages/schemas` if needed.
- Require admin authentication.
- Consider audit logging for unpublished content export.
- Keep canonical source text separate from Translation Pack Draft export.

## Acceptance Criteria For MVP Implementation

- CMS can export Markdown from a loaded Episode.
- CMS can export TSV from a loaded Episode.
- Markdown grouping is Page -> resolved Panel -> Bubble, with unresolved
  Bubbles grouped at page level.
- Export must not assume Bubbles are nested under Panels; it supports Bubbles
  with missing/null Panel references.
- Export output is deterministic even when ordering fields are missing or
  duplicated.
- `Bubble.textOriginal` is the source of truth.
- Speaker formatting follows the rules above.
- Existing Bubbles with missing text render `[textOriginal未入力]` in Markdown.
- Existing Bubbles with missing text and a speaker render
  `speaker: [textOriginal未入力]` in Markdown.
- Pages with no Bubbles render `テキストなし` in Markdown.
- Serializer unit tests cover resolved Panel Bubbles, missing/null Panel
  references, empty/null `textOriginal`, speakerless output,
  case-insensitive `unknown` speaker handling, TSV tab/line-break escaping, and
  deterministic ordering with missing/duplicated order fields.
- No API/schema changes are required for MVP.
- `pnpm --filter @manga/cms build` passes.
- Run the relevant CMS test command if available, and document when no CMS test
  script exists.
