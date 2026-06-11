# Reader HTML Text Layer Spec

This document records a future Reader enhancement for rendering Bubble text as
HTML above page images. It is intentionally design-level until the contract,
Viewer, and QA work are implemented in separate steps.

## Purpose

The current Reader is image-first. That should remain the default. An optional
HTML text layer may be useful for selected self-hosted works that want:

- selectable and searchable Bubble text;
- better accessibility and future read-aloud support;
- browser translation experiments when no official Translation Pack exists;
- stable Bubble anchors for deep links and review workflows.

This feature exposes full Bubble text in public HTML. That is useful for
accessibility and translation, but it also increases scraping and indexing
surface. For that reason, the text layer must be opt-in and feature-flagged.

## Non-Goals

- Do not replace page images as the primary manga reading surface.
- Do not make the Reader a canonical text editor.
- Do not require existing content to add layout metadata.
- Do not change the meaning of `Bubble.textOriginal`.
- Do not migrate half-width spaces into line breaks.
- Do not make browser translation the official translation workflow.
- Do not expose draft, private, or rights-blocked text in public HTML.

## Content Contract Boundary

The canonical hierarchy remains:

```text
Series -> Episode -> Page -> Panel -> Bubble
```

`Bubble.textOriginal` remains canonical source text for proofreading,
translation matching, text export, feedback context, search, read-aloud, and
public share descriptions.

Explicit visual line layout should use optional metadata described in
[`docs/manga-content-v2-spec.md`](manga-content-v2-spec.md):

```ts
interface BubbleTextLayout {
  lines?: string[];
  source?: "manual" | "imported" | "ocr";
}
```

A future optional style extension may be added alongside it:

```ts
interface BubbleTextStyle {
  fontSizePx?: number;
  fontWeight?: number;
}
```

`fontSizePx` is in the original page image pixel coordinate system. It is a
layout hint, not canonical text.

Adding optional layout/style fields does not require `schemaVersion: 3` while
old content remains valid and writers/readers can ignore the fields safely.

## Rendering Model

The proposed rendering model is:

```text
.page-stage
  img.page-image
  .bubble-layer
    p.bubble
    p.bubble
```

Rules:

- DOM order must follow Bubble reading order.
- Bubble elements should be flat siblings, not nested inside Panel wrappers.
- Panel context should be stored as `data-panel-id` only.
- Visual placement comes from absolute positioning over the page image.
- `bbox` pixel coordinates are converted to percentages during SSR.
- Font size and padding should use container query units (`cqw`) so text scales
  with the page image instead of the viewport.
- `textLayout.lines` should render as one text node joined with `\n` and
  displayed with `white-space: pre-line`.
- If `textLayout.lines` is missing, render `textOriginal` as the source text.
- Ruby markup, if supported later, must be escaped and tokenized safely. Do not
  build untrusted HTML strings from Bubble text.

The coordinate goal is that resizing, spread mode, and responsive layouts do not
require client-side coordinate recalculation.

## Browser Translation Strategy

Official translations should continue to use published Translation Packs or
localized page images. Browser translation is only a fallback experiment.

The planned browser-translation mode is:

- detect translation through multiple signals, such as `html:lang(...)`,
  `translated-ltr` / `translated-rtl`, and a JS-set `data-mtl` fallback;
- switch vertical Bubble text to horizontal layout when translated;
- hide ruby `<rt>` text in translated mode;
- refit overflowing translated text with a small isolated script;
- fall back to Bubble-internal scrolling when fitting cannot preserve
  readability.

Translation engine behavior changes by browser and version. Any implementation
must include real-browser QA notes rather than assuming one engine behavior.

## Public Safety Gates

The text layer must only render when all of these are true:

- the Series/Episode policy explicitly enables it;
- the target content is public and rights-cleared;
- the Bubble is active/shareable enough for public text exposure;
- the requested locale is allowed for public display;
- the page image itself is already public Reader content.

When in doubt, the Reader should fall back to image-only rendering.

## Implementation Plan

### Step 1: Contract Preparation

- Add optional `textLayout` and `textStyle` fields only after updating domain
  types, Zod schemas, and API docs together.
- Keep existing content valid without these fields.
- Add content-lint warnings, not hard validation failures, for layout/source
  mismatches.

### Step 2: Viewer Prototype

- Add a small Reader component for the HTML text layer.
- Gate it behind a policy/feature flag that defaults off.
- Render only selected test content with reviewed Bubble text.
- Verify selection, search, anchor links, reading order, and responsive
  positioning.

### Step 3: Translation And Overflow QA

- Add translation detection and overflow fitting in a separate script.
- Keep it separate from the main Reader navigation script.
- Test Chrome, Safari, and Google Translate paths where possible.
- Record browser/version and observed translation signals in QA notes.

### Step 4: CMS Review Workflow

- Add CMS editing only after the rendering model proves stable.
- Keep `textOriginal`, `textLayout.lines`, and Translation Pack text visibly
  separate.
- Require human review for imported or OCR-proposed layout lines.

## Open Questions

- Which works are allowed to expose full Bubble text in public HTML?
- Should the feature be Series-level, Episode-level, or Pack-level?
- How should official Translation Pack line layout be stored?
- What minimum accessibility behavior is required before launch?
- Should search indexing include text-layer pages, or should the feature remain
  `noindex` for early experiments?

