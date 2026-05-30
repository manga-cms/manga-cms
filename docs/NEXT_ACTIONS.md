# Next Actions

This is the practical task split for starting the first public manga site.

For ready-to-paste Codex prompts for the next parallel workstreams, see
`docs/next-thread-instructions.md`.

## Current State

- The repository has been pushed to `https://github.com/manga-cms/manga-cms`.
- The codebase can be published as open source.
- A free manga site can be launched once prepared page images and JSON content
  are available.
- Commercial sale and gated production reading still need operations work.
- Reader, CMS, and Rights responsibilities are now split in dedicated specs:
  - `docs/reader-ux-spec.md`
  - `docs/feedback-mvp-spec.md`
  - `docs/cms-ux-spec.md`
  - `docs/translation-governance-spec.md`
  - `docs/rights-permission-spec.md`
  - `docs/storyboard-data-import.md`

## Product Boundary

- Reader is for reading, sharing, approved pack display, and lightweight proposals.
- CMS is for structure editing, translation/footnote review, pack management, and publishing.
- Rights controls who can propose, edit, review, publish, and commercially use content by series, language, and pack.
- Reader must not become the primary editor; CMS must include Reader preview.

## Human Tasks

- Confirm whether the existing sample content can remain public.
- Choose the first real series to publish.
- Confirm rights for artwork, story, lettering, translations, and any comments.
- Provide page images for the first episode.
- Decide whether the first launch should be free-only or include gated content.
- Decide the public positioning: experimental OSS, creator tool, or manga site.

## Codex Tasks

- Keep `/deliver/:pageId` path containment covered as delivery evolves toward CDN or watermark output.
- Refactor the fat Viewer episode page before adding more Reader interactions:
  split SSR data loading, metadata, reader layout, Explore panel, feedback modal,
  and client-side reader controls into smaller modules.
- Add Reader mobile polish: stronger image preload/decode handling, blank-page
  prevention, RTL swipe tuning, double-tap zoom, and Explore bottom sheet on
  small screens.
- Upgrade the read-complete surface with next Episode, reaction, share, and
  contribution actions.
- Add Page OGP first, then Clip/Quote dynamic share images once official
  Clip/Quote records are available.
- Convert provided manuscript/page assets into `contents/` structure.
- Create or validate `series.json` and `episode.json`.
- Add panel and bubble metadata where needed for quote/clip features.
- Align Reader behavior with `docs/reader-ux-spec.md`: Normal Mode hides overlays; Study Mode exposes footnotes, translation comparison, lightweight proposals, and focus-link target inspection.
- Expand Reader feedback from the current MVP into CMS triage: list feedback, inspect target context, close/triage, and convert approved items into proposals.
- Bring the viewer closer to the medamayaki reader model: right-to-left page flow, keyboard/tap navigation, minimal chrome during reading, and a read-completion surface.
- Refactor `PageStructureReview.tsx` into focused CMS components before adding
  deeper editor behavior.
- Add CMS canvas zoom/pan, fit presets, and coordinate conversion checks for
  high-resolution Page Structure Review.
- Add CMS editing safety: undo/redo, dirty-state browser warning, and local
  autosave/recovery for structure review.
- Add a Translation Workspace MVP with surrounding Bubble/Panel context.
- Expand the CMS Review UI for page structure: image overlay, draggable panel boxes, draggable bubble boxes, template-assisted panel creation, reading-order labels, text/footnote proposals, accept/reject, and save to canonical draft.
- Connect ingestion artifacts to that Review UI so panel/bubble candidates are auto-filled but remain human-confirmed before entering canonical content.
- Add Proposal Queue contracts for translation, typo, footnote, commentary, tag, and structure proposals.
- Add Pack Manager contracts for translation, footnote, commentary, learning, and accessibility packs.
- Add Rights/Role Manager MVP contracts for owner/editor/translator/reviewer/contributor permissions.
- Wire CMS publication scheduling controls to the Series/Episode scheduling
  contract (`publishStartAt`, `publishEndAt`, `visibility`). A minimal Episode
  bulk status-change workflow now exists on the Work detail screen; expand it
  later if release operations need saved presets or review approvals.
- Add bulk import contracts for prepared episode directories or archives so page
  images and draft metadata can be imported without hand-entering every page.
- Add share policy and spoiler policy schemas.
- Add official Quote / Clip / Reaction data structures.
- Add Page OGP first, then official Quote / Clip / Reaction OGP.
- Keep the Obsidian project manual and GitHub docs in sync.

## Suggested Next Sprint

1. Confirm sample-content rights and choose the first real Series.
2. Refactor the Viewer episode page into smaller modules.
3. Add Reader preload/blank-page prevention and mobile swipe/zoom polish.
4. Add a dedicated read-complete surface.
5. Refactor Page Structure Review into focused CMS components.
6. Add CMS canvas zoom/pan and editing safety.
7. Add CMS Rights/Role Manager UI on top of the existing Rights API.
8. Add the first real episode assets through prepared import.
9. Use CMS panel templates and manual Bubble editing to structure the first episode.
10. Validate Reader/API rendering locally across mobile/tablet/desktop.
11. Add Page OGP and then official Quote / Clip records.
12. Run a public-launch smoke rehearsal.

## Post-Launch Engineering Backlog

- Split `apps/api/src/index.ts` by route domain once launch validation is stable.
- Move request validation toward route-level Zod schemas instead of per-handler checks.
- Consolidate the Prisma schema source of truth between the root design schema and `packages/db`.
- Decide when the current `contents/{series}/{episode}/episode.json` shape should evolve toward page/panel/bubble files.
- Replace single-instance rate limiting with a shared store before multi-instance deployment.
