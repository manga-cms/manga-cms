# Lettering Tool Spec

Status: design-level. This document defines a WYSIWYG lettering (typesetting)
tool for Manga CMS. Contract details remain owned by the executable sources of
truth; this spec references them rather than duplicating them.

## Context (read before implementing)

Manga CMS publishes structured manga: `Series -> Episode -> Page -> Panel ->
Bubble`. Canonical content lives in `contents/` and `packs/`; the runtime DB is
operational state only. Reader text overlay renders Bubble text as HTML over a
blank-bubble page image (`/works/{id}/episodes/{id}/overlay`, feature-flagged,
`noindex`).

Existing assets this tool reuses (do not rebuild):

- Reader overlay rendering: `apps/viewer/src/lib/episode-text-overlay.ts`
  (image resolution, env, PublishedPack lookup, per-language vertical/horizontal,
  cqw scaling) and `apps/viewer/src/scripts/text-overlay-fit.ts` (DOM-measured
  refit).
- CMS structure editing: `apps/cms/src/pages/PageStructureReview.tsx` and
  `apps/cms/src/components/structure-review/CanvasOverlayEditor.tsx` (bbox drag
  editing; no text rendering yet).
- Permissions: Rights grants (`packages/domain/src/rights-types.ts`:
  `edit_structure`, `edit_translation`, `publish_pack`, `manage_rights`,
  `moderate_proposals`, `propose_*`).
- Review: Proposal Queue (`/admin/proposals`, currently global-admin scoped) and
  public feedback (`POST /feedback`).
- Writers: `content-writer` (canonical `contents/`), Translation Pack Draft +
  export (`packs/`).

Decisions already made with the maintainer:

- Three actors: author = immediate apply, editor = apply after author approval
  (proposal), reader = proposal.
- Full lettering scope (line breaks, position, size, line/letter spacing, bbox)
  is the end goal; implemented in phases.
- Per-language typesetting: line layout/style is language-specific
  (ja = canonical Bubble, translations = Translation Pack entry); **bbox is
  shared across languages** (Bubble.bbox). Per-language bbox/image variants
  (idea J in `docs/IDEA-BACKLOG.md`) are future work.
- Both surfaces: readers propose on the overlay; authors/editors do full
  lettering in CMS. Approach: extend existing assets, not a new subsystem.
- `Bubble.textOriginal` and Pack `text` stay immutable normalized text;
  typesetting goes into separate optional fields.

Related specs (keep in sync; canonical contract owner in parentheses):

- `docs/api-contract.md` (HTTP + domain contract — owner)
- `docs/manga-content-v2-spec.md` (content v2 layout/style design)
- `docs/reader-text-layer-spec.md` (overlay rendering + space-as-break)
- `openapi.yaml`, `packages/domain/src/types.ts`,
  `packages/schemas/src/content.ts` (executable truth)

When this spec and the above disagree, fix this spec or update the contract
owner explicitly. Do not let this document become a second source of truth for
schema.

## Section 1: Data model

All typesetting fields are optional additive extensions (backward compatible,
`schemaVersion` unchanged). Missing fields fall back to current behavior
(auto refit). `textOriginal` / Pack `text` remain immutable normalized text.

Add to **both** `Bubble` and `PackEntry` as **top-level optional** fields (not
under `metadata`, so they survive `PublishedPackEntry`):

```ts
interface BubbleTextLayout {
  lines?: string[];                          // display line splits (explicit breaks)
  inlineAlign?: "start" | "center" | "end";  // inline axis (line direction):
                                             // start = horizontal -> line head (left);
                                             //         vertical   -> top
  blockAlign?: "start" | "center" | "end";   // block axis (line stacking):
                                             // start = horizontal -> top;
                                             //         vertical-rl -> right
  source?: "manual" | "imported" | "ocr";
}

interface BubbleTextStyle {
  fontSizePx?: number;     // manuscript pixel coordinate system (same as bbox); overlay -> cqw
  fontWeight?: number;     // 100..900, multiples of 100
  lineHeight?: number;     // unitless multiplier (e.g. 1.3)
  letterSpacing?: number;  // manuscript pixel px
  fitMode?: "auto" | "shrink" | "fixed";
  // auto   = current auto refit (default before lettering)
  // shrink = fontSizePx is base; safety-shrink only on overflow
  // fixed  = fontSizePx fixed; overflow handled by data-overflow="scroll"
}
```

Add to `packages/schemas` / `openapi.yaml` / `packages/domain/src/types.ts`.

Rules for implementers:

- fitMode resolution: `textStyle.fitMode ?? (textStyle.fontSizePx != null ?
  "shrink" : "auto")`. `shrink`/`fixed` without `fontSizePx` -> lint warning +
  `auto` fallback.
- Numeric constraints (Zod + OpenAPI): `fontSizePx > 0`; `fontWeight` 100..900
  multiples of 100; `lineHeight > 0`; `letterSpacing` finite; with sane upper
  bounds. Enforced at the schema boundary: invalid canonical/pack JSON is
  rejected at load/validate/publish (deploy) time, so the Reader never receives
  out-of-range typesetting from canonical sources. See Error Handling for the
  Reader-side defensive layer.
- Position offset: `inlineAlign`/`blockAlign` (9 combinations) is the MVP. No
  free pixel offset. If sub-align nudging is needed later, add
  `textOffsetPx: { x, y }` (manuscript px, bbox unchanged) — deferred.
- Overlay read order: the active display text is `Bubble.textOriginal` for ja
  and the matching `PackEntry.text` for translations. If `textLayout.lines` is
  present, render it joined with `\n` (`white-space: pre-line`); else render the
  active display text. If `textStyle` present apply
  size/weight/line-height/letter-spacing; else auto refit. Typeset bubbles
  prefer `lines` over the `READER_TEXT_OVERLAY_SPACE_AS_BREAK` experiment, so
  the half-width-space ambiguity is resolved at the source.
- Integrity lint (content-lint warning, never hard error): the display string
  from `textLayout.lines` should roughly match canonical text. Language-aware
  join: CJK uses `lines.join("")`, alphabetic translations use `lines.join(" ")`.
  Language determination: Bubble uses `bubble.lang ?? "ja"`; PackEntry uses
  `entry.language ?? pack.language`. Mismatch warns "lines may be stale".
- Wire naming: Proposal/feedback APIs use snake_case `text_layout` / `text_style`
  on the wire; canonical content and Pack manifests use `textLayout` /
  `textStyle`. Convert at the boundary.

## Section 2: Surfaces

### A. CMS lettering view (author/editor) = Page Structure Review extension

A "lettering mode" added to Page Structure Review, three panes:

- Left: page nav (reuse progress grid) + language tabs (ja / en / zh-Hans / sv).
- Center: overlay preview (blank-bubble image + live typesetting), extending
  `CanvasOverlayEditor` (bbox drag stays; text rendering added).
- Right: lettering inspector for the selected Bubble's `textLayout`/`textStyle`
  (lines, inlineAlign/blockAlign, fontSizePx/fitMode, lineHeight/letterSpacing).

Language tabs switch typesetting only (ja = Bubble, translations = the matching
runtime Translation **Pack Draft** entry — not a published Pack). bbox is
language-shared, so it does not change across tabs.

### B. Reader proposal layer (reader) = overlay extension

The public overlay gains an explicit proposal mode (opened on demand, per
`docs/reader-ux-spec.md`). Readers adjust a limited set
(`inlineAlign`/`blockAlign`/`lines`/`fontSizePx`; **bbox is not movable** since
it is language-shared) and submit. Submission goes through the public feedback
path (Section 3), not directly to `/admin/proposals`.

### Shared renderer core (key)

Extract a single **app-neutral renderer core**: text resolution, layout/style
application, CSS-variable generation, fitMode handling, and the DOM-measured
refit. Viewer/Astro and CMS/React are thin wrappers over it.

WYSIWYG match is **conditional**: identical only when the CMS preview and public
overlay use the same CSS, the same font assets, the same page-pixel
coordinates, the same refit implementation, and the same browser rendering
path. The CMS preview must run the same DOM-measured refit as the overlay.

## Section 3: Save flow (permission-based)

Maps the three actors onto existing Rights/Proposal without new permissions:

```text
manage_rights:                 apply ja lettering to canonical Bubble
publish_pack OR manage_rights: export/publish Translation Pack Draft
edit_structure / edit_translation / reader: create lettering proposal only
moderate_proposals:            proposal accept/reject only (never apply)
```

Enforcement and endpoints:

- Immediate ja save needs server enforcement: a **lettering-specific narrow
  patch endpoint** gated by `manage_rights`, AND a guard in full Episode save
  that rejects `textLayout`/`textStyle` diffs (otherwise `edit_structure`
  holders could apply via normal full save).
- Translation lettering: write `textLayout`/`textStyle` to the Pack **Draft**
  entry (Pack Draft entry patch/upsert endpoint); a separate export/publish step
  (`publish_pack`) is required to reach the Reader. These are two stages.
- Reader proposals: submit via public `POST /feedback` with a new
  `issue_type: "lettering"`; CMS converts feedback into a Proposal Queue record
  (existing feedback -> proposal flow). Do not send readers to `/admin/proposals`.
- Editor proposals: `lettering` Proposal Queue records. Requires a
  **series-scoped** proposal creation path (current `/admin/proposals` is
  global-admin only) usable with `edit_structure`/`edit_translation`.
- `lettering` proposals cannot reuse `adopt-proposal` (which maps
  `suggested_text` -> Pack Draft `text`). They need dedicated apply:
  ja proposal -> Bubble `textLayout/textStyle` patch; translation proposal ->
  Pack Draft entry `textLayout/textStyle` patch.

ProposalKind/payload: add `kind: "lettering"` to
`packages/domain/src/proposal-types.ts` and `packages/schemas/src/proposal.ts`
with a strict payload `{ series_id, episode_id, page_id, bubble_id, lang,
text_layout?, text_style? }` (typed, not arbitrary JSON). Use `lang` to match
the existing Proposal/Feedback wire field, not `language`.

## Section 4: Phases

Each phase delivers value independently. Dependencies flow top to bottom.

### Phase 0: Data contract + overlay read (no UI, highest ROI)

- Add `textLayout`/`textStyle` optional to Bubble/PackEntry across
  domain/schemas/openapi, with numeric constraints, fitMode resolution, and the
  integrity lint (language-aware join).
- Overlay reads and applies typesetting (present -> apply, absent -> current
  refit).
- Write guard from day one (P1): full Episode save and Pack Draft write must
  reject or strip `textLayout`/`textStyle` diffs, so merely adding the fields
  does not let `edit_structure`/`edit_translation` holders apply typesetting via
  existing full-save paths. The `manage_rights`-gated narrow patch endpoint
  arrives in Phase 2; until then typesetting enters only via hand-authored
  content/pack JSON validated at deploy time. Without this guard, Phase 0 would
  temporarily break the Section 3 permission model.
- Pack Draft `translation-import` does NOT accept `text_layout`/`text_style`
  yet. For Phase 0, translation typesetting is entered via hand-written
  `pack.json` only. (Extending import schema + column spec to carry typesetting
  is a Phase 3 item, not Phase 0.)
- Effect: hand-authored JSON controls line breaks, size, and spacing in the
  overlay; the half-width-space problem is solved at the source via `lines`.
- Verify: `pnpm --filter @manga/domain build`,
  `pnpm --filter @manga/schemas build`, `pnpm validate:content`,
  Viewer overlay build + a narrow overlay render test.

### Phase 1: Shared renderer core

- Extract the app-neutral renderer core (text resolution, layout/style, CSS
  vars, fitMode, DOM-measured refit). Viewer becomes a thin wrapper; no visual
  change.
- Verify: `pnpm --filter @manga/viewer build`, overlay smoke unchanged.

### Phase 2: CMS lettering view (author, ja, immediate)

- Lettering mode in Page Structure Review (three panes) for ja
  `textLayout`/`textStyle`.
- Narrow patch endpoint (`manage_rights`) -> canonical Bubble; full Episode save
  guard rejecting typesetting diffs.
- Verify: `pnpm --filter @manga/cms build`, `pnpm --filter @manga/api build`,
  api roundtrip smoke, manual: edit ja -> immediate canonical -> overlay shows it.

### Phase 3: CMS lettering view (translations, Pack Draft)

- Language tabs editing Pack Draft entries; Pack Draft entry patch/upsert
  endpoint; export/publish (`publish_pack`).
- Optionally extend `translation-import` to carry `text_layout`/`text_style`
  (schema + column spec) here.
- Verify: cms/api build, Pack Draft -> export -> overlay `?lang=` shows
  typesetting.

### Phase 4: Proposal flow (editor + reader)

- `lettering` ProposalKind/payload; dedicated apply (ja=Bubble / translation=Pack
  Draft); `/feedback` `lettering` issue type -> Proposal; series-scoped proposal
  creation; `moderate_proposals` accept/reject + `manage_rights`/`publish_pack`
  apply.
- Verify: schemas/domain/api build, smoke: create lettering proposal (editor),
  feedback->proposal (reader), apply (author) -> canonical/Pack updated.

### Phase 5: Overlay reader proposal layer

- Lightweight proposal mode on the public overlay (align/lines/fontSizePx only)
  -> feedback submission. Keep overlay `noindex`, no canonical write from public.
- Verify: viewer build, overlay smoke (200/noindex/metadata non-leak),
  proposal lands as feedback.

## Error handling and testing (summary)

- Two layers (no contradiction with the Zod constraints in Section 1): (1) the
  schema boundary rejects invalid typesetting in canonical/pack JSON at
  load/validate/publish time, so bad values never become source of truth;
  (2) the Reader still defends per field — a missing or out-of-range value at
  render time is sanitized/clamped and that field falls back to auto refit,
  never throwing.
- Integrity issues are warnings, never hard validation errors.
- Public surfaces keep existing gates: overlay `noindex`, published Pack only,
  no Pack Draft / machine-origin / provider metadata leak, canonical immutable
  from public paths.
- Each phase carries the verification commands above; contract changes update
  `openapi.yaml` + `docs/api-contract.md` together.
