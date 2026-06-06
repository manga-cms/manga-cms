# Manga Content V2 Spec

This document records design rules for the current canonical content model.
The hierarchy remains:

```text
Series -> Episode -> Page -> Panel -> Bubble
```

The current canonical manga content store is still `contents/`, and current
content remains `schemaVersion: 2`. Do not introduce `schemaVersion: 3` only to
add optional review or layout metadata.

## Bubble Text And Lettering Layout

`Bubble.textOriginal` is the canonical source text for the current content
edition. It is the source used for proofreading, translation matching,
feedback/proposal context, search indexing, read-aloud text, and crawler-safe
quote generation.

`Bubble.textOriginal` is not a typesetting layout field:

- Do not treat half-width spaces as automatic line breaks.
- Do not treat half-width spaces as visual separators for vertical lettering.
- Do not run automatic migration that turns spaces into lines.
- Do not overwrite `Bubble.textOriginal` with translated text.
- Do not require existing content to add layout metadata.

### Candidate Shape

If CMS needs explicit line layout, prefer an optional grouped object:

```ts
interface BubbleTextLayout {
  lines?: string[];
  source?: "manual" | "imported" | "ocr";
}

interface Bubble {
  textOriginal: string;
  textLayout?: BubbleTextLayout;
}
```

`textLayout.lines` is preferred over a top-level `textLines` field because it
keeps layout concerns grouped and leaves room for future lettering hints without
changing source text semantics. A top-level `textLines: string[]` is simpler,
but it is easier to mistake for canonical text.

This is a design-level optional extension until `packages/domain`,
`packages/schemas`, `openapi.yaml`, and writer validation are updated together.

### Newline In textOriginal Versus lines Array

Option A: encode line breaks directly in `textOriginal` with `\n`.

Pros:

- Easy to edit in plain JSON.
- No extra field is needed.
- Existing text rendering can preserve line breaks if it opts in.

Cons:

- Canonical source text becomes mixed with visual layout.
- Search, read-aloud, Translation Pack matching, and CSV/TSV export need to
  decide whether the newline is text, layout, or both.
- Crawler descriptions can become unstable if line breaks are preserved in some
  paths and collapsed in others.
- It encourages accidental line layout changes when editors only meant to fix
  text.

Option B: keep `textOriginal` normalized and store layout in
`textLayout.lines`.

Pros:

- Keeps canonical text independent from lettering layout.
- Translation Pack import can keep comparing source rows to `textOriginal`.
- Search and read-aloud can normalize source text without losing layout data.
- CMS can show and edit line layout only in dedicated review/typesetting UI.
- Share descriptions can use deterministic source-text normalization.

Cons:

- Requires future schema/API/UI work.
- Editors need a clear CMS workflow to keep `textLayout.lines` aligned with
  `textOriginal`.
- Exporters may need both source text and layout columns.

Decision: use Option B for future implementation. `textOriginal` remains the
canonical source text; `textLayout.lines` is optional visual layout metadata.

### Downstream Behavior

Translation Packs:

- Translation Pack entries keep targeting canonical Bubble IDs and canonical
  `Bubble.textOriginal`.
- Translation import mismatch detection compares incoming source text with
  `Bubble.textOriginal`, not layout lines.
- Translation-specific line layout belongs in Pack entry metadata or a future
  Pack text-layout field, not in canonical Bubble source text.

Full text export:

- Markdown/TSV/JSON export should keep `Bubble.textOriginal` as the primary
  source field.
- Export may add optional layout fields, such as `text_layout_lines`, only
  after CMS can review them.
- TSV/CSV export should escape real line breaks and must not infer line breaks
  from spaces.

Share descriptions:

- Share URL metadata should ignore `textLayout.lines`.
- Bubble quote descriptions use public-safe normalized text derived from
  `Bubble.textOriginal`.
- Metadata generation should collapse whitespace deterministically and avoid
  leaking draft/private layout notes.

Read-aloud:

- Read-aloud uses `Bubble.textOriginal` with normal whitespace normalization.
- Layout lines are visual and should not imply pauses unless a future
  accessibility-specific field defines that behavior.

Search:

- Search indexes normalized `Bubble.textOriginal`.
- Layout lines may be indexed only as auxiliary display context, not as a
  replacement for canonical text.

CMS review:

- CMS should let humans confirm or edit line layout.
- Import/OCR tools may propose line layout, but accepted canonical layout must
  be reviewer-approved.
- Existing content is not auto-converted.

### Schema Version Boundary

`schemaVersion: 2` is enough when:

- `textLayout` is optional.
- Missing `textLayout` means existing rendering/export behavior.
- `textOriginal` keeps the same canonical source-text meaning.
- Writers and readers can ignore `textLayout` safely.

`schemaVersion: 3` becomes necessary only when:

- Line layout becomes required for valid Bubble records.
- `textOriginal` changes from canonical source text to a display/layout field.
- Existing content must be migrated mechanically.
- Reader, CMS, API, and export behavior can no longer safely ignore the new
  field.

Any v3 migration must include a reader/writer migration plan and compatibility
tests before content files are rewritten.
