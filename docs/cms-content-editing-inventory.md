# CMS Content Editing Inventory

Scope: Creator CMS only. Shared API contracts, schemas, canonical content, and
Viewer behavior are not changed by this note.

## Current CMS Coverage

- Series: `WorkDetail` edits title, description, `publicationType`,
  `lifecycleStatus`, legacy `status`, visibility, and publish window.
- Episode: `EpisodeEditor` edits title, episode number, published date,
  visibility, publish window, Page image path/upload, and Reader preview.
- Page: `EpisodeEditor` manages Page stubs and image paths; Page Structure
  Review loads the full Episode and saves complete Page structure back through
  the Episode save route.
- Panel: Page Structure Review supports bbox editing, reading order by list
  movement, accept/reject, and template-assisted setup.
- Bubble: Page Structure Review supports bbox editing, source text
  (`Bubble.textOriginal`), reading order, speaker, bubble type, language,
  flags, accept/reject, and local safety features.
- Text: canonical source text remains `Bubble.textOriginal`; English text must
  not overwrite canonical Episode JSON.
- Translation: Bubble-level proposal flow exists in Translation Workspace.
  Episode-level bulk import now routes English rows into runtime Translation
  Pack Drafts.

## Translation Draft Import Flow

CMS import flow is:

1. Open an Episode import screen from Work Detail, Episode Editor, Structure
   Review, or a scoped Translation Pack Draft.
2. Paste CSV or JSON rows with `bubble_id`, `source_text`, `text`, and optional
   `comment`.
3. Preview row matching against canonical Bubbles. The UI also accepts
   `bubbleId`, `id`, `shortId`, and `displayRef` and resolves them to canonical
   `bubble_id` before calling the API.
4. Create or select a runtime `TRANSLATION` Pack Draft for the Series/Episode
   and language such as `en`.
5. Run API preview with `apply: false`.
6. Apply only after reviewing unmatched rows, missing canonical Bubbles,
   duplicate rows, source text mismatch warnings, and existing-entry conflicts.

The apply step calls
`POST /admin/pack-drafts/{packDraftId}/translation-import` with normalized
entries. It adds Pack Draft entries only and does not mutate canonical Episode
JSON or export canonical `packs/`.

## API Notes

No shared contract change is required for the current CMS MVP.

Future API/Core work worth considering before multi-editor production:

- Partial Page/Panel/Bubble patch endpoint with revision checks to avoid full
  Episode replacement conflicts.
- Server-side CSV upload/parser endpoint if browser-side paste/import becomes
  too large for normal CMS operation.
- Pack Draft entry update/delete endpoints for correcting imported rows after
  apply without recreating a draft.
