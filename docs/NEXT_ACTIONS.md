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
- Convert provided manuscript/page assets into `contents/` structure.
- Create or validate `series.json` and `episode.json`.
- Add panel and bubble metadata where needed for quote/clip features.
- Align Reader behavior with `docs/reader-ux-spec.md`: Normal Mode hides overlays; Study Mode exposes footnotes, translation comparison, lightweight proposals, and focus-link target inspection.
- Expand Reader feedback from the current MVP into CMS triage: list feedback, inspect target context, close/triage, and convert approved items into proposals.
- Bring the viewer closer to the medamayaki reader model: right-to-left page flow, keyboard/tap navigation, minimal chrome during reading, and a read-completion surface.
- Expand the CMS Review UI for page structure: image overlay, draggable panel boxes, draggable bubble boxes, template-assisted panel creation, reading-order labels, text/footnote proposals, accept/reject, and save to canonical draft.
- Connect ingestion artifacts to that Review UI so panel/bubble candidates are auto-filled but remain human-confirmed before entering canonical content.
- Add Proposal Queue contracts for translation, typo, footnote, commentary, tag, and structure proposals.
- Add Pack Manager contracts for translation, footnote, commentary, learning, and accessibility packs.
- Add Rights/Role Manager MVP contracts for owner/editor/translator/reviewer/contributor permissions.
- Wire CMS publication scheduling controls to the Series/Episode scheduling
  contract (`publishStartAt`, `publishEndAt`, `visibility`) and add any needed
  bulk status-change workflow.
- Add bulk import contracts for prepared episode directories or archives so page
  images and draft metadata can be imported without hand-entering every page.
- Add share policy and spoiler policy schemas.
- Add official Quote / Clip / Reaction data structures.
- Add Page OGP first, then official Quote / Clip / Reaction OGP.
- Keep the Obsidian project manual and GitHub docs in sync.

## Suggested Next Sprint

1. Confirm sample-content rights.
2. Add GitHub repository description and topics.
3. Add the first real episode assets.
4. Validate viewer/API rendering locally.
5. Validate Reader against `docs/reader-ux-spec.md`, especially Normal Mode vs Study Mode, focus links, and mobile/tablet/desktop viewport behavior.
6. Use CMS panel templates to structure the first real/storyboard episode, then manually add Bubble boxes and text for key pages.
7. Connect ingestion artifacts to the CMS page-structure review editor so panel/bubble candidates can prefill templates.
8. Add CMS Feedback Triage for records saved by `POST /api/v1/feedback`.
9. Add Proposal Queue data contracts and minimal CMS list/detail UI.
10. Add Pack Manager MVP for Translation Pack and Footnote Pack.
11. Add Rights/Role Manager MVP for language-specific translation permissions.
12. Add official Quote / Clip records for the first episode.

## Post-Launch Engineering Backlog

- Split `apps/api/src/index.ts` by route domain once launch validation is stable.
- Move request validation toward route-level Zod schemas instead of per-handler checks.
- Consolidate the Prisma schema source of truth between the root design schema and `packages/db`.
- Decide when the current `contents/{series}/{episode}/episode.json` shape should evolve toward page/panel/bubble files.
- Replace single-instance rate limiting with a shared store before multi-instance deployment.
