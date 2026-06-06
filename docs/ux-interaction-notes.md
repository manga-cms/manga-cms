# UX Interaction Notes

This note records Reader and CMS interaction decisions that are still design
level. It does not change API, schema, or database contracts.

## Bubble Selection UI

Recommended first direction:

- Reader uses lightweight targets: hidden in Normal mode, visible only in
  Explore/Study mode, centered on the text or derived from the Bubble bbox.
- Reader shows a subtle bbox highlight only after selection.
- CMS uses editable Panel and Bubble bboxes, with OCR text and confidence shown
  as review metadata when available.
- Exact bubble shape or polygon detection is deferred.

This matches the current product split: Reader is for reading and lightweight
feedback, while CMS is the canonical editing and review surface.

## Option Review

| Option | Reader impact | CMS impact | Detection cost | Recommendation |
| --- | --- | --- | --- | --- |
| Exact bubble shape cutout | Visually precise, but noisy and fragile when wrong | Harder to edit than rectangles | High | Defer |
| Round target at OCR text center | Low visual noise and mobile friendly | Needs CMS fallback for correction | Low to medium | Use for Reader |
| Raw OCR/detection bbox as selection frame | Clear target, but can cover art/text and expose errors | Useful as an editable candidate | Low | Use mainly in CMS |
| CMS bbox, Reader center/highlight | Keeps Reader calm and CMS correctable | Fits current structure review model | Low | Primary MVP |
| Separate Panel, Bubble, text span UI | Best long-term targeting for quote, feedback, translation, footnote | Requires more structure and review states | Medium to high | Design now, phase in |

## Reader UI

Normal mode:

- No visible Bubble or Panel overlays.
- Reader navigation and page image remain primary.
- Approved footnote markers may appear only as small, unobtrusive markers.

Explore/Study mode:

- Show small circular Bubble targets at text center, or at the center of the
  Bubble bbox when text-center data is missing.
- Keep Panel targets visually secondary and use them for scene-level notes,
  clip/reaction context, and display feedback.
- On selection, show a light bbox highlight and update the bottom sheet or side
  panel with source text, target label, and feedback/proposal actions.
- Avoid using exact shape masks in Reader until there is strong evidence that
  they improve reader comprehension without adding visual noise.

Mobile behavior:

- Target size should be large enough for touch even if the visual marker is
  small.
- If multiple Bubble targets overlap, prefer selection by nearest center and
  show a compact disambiguation list only when needed.
- Long press can remain a secondary entry for context actions, but normal tap in
  Explore mode should be enough for Bubble selection.

## CMS UI

Structure Review should stay bbox-first:

- Editable Panel bbox.
- Editable Bubble bbox.
- Reading-order labels.
- OCR/source text display.
- Candidate accept/reject state.
- Warnings for small or out-of-page bboxes.

When ingestion metadata exists, CMS should show:

- OCR text.
- Detection/OCR confidence.
- Optional text center point.
- Source detector name or run id if available.

CMS should not require exact polygon editing for MVP. Polygon or shape editing
can be added later as optional advanced metadata if it proves useful for
translation fit, accessibility, or visual extraction.

## Minimum Detection Data

Minimum data needed for the MVP experience:

- Page width and height in pixel coordinates.
- Page image id or image reference.
- Panel id, reading order, and bbox.
- Bubble id, owning panel id or null, reading order, and bbox.
- OCR/source text for each Bubble.
- Confidence for OCR text and detection, at least in ingestion artifacts or CMS
  review metadata.

Reader can derive the first center point from Bubble bbox:

```text
center.x = bbox.x + bbox.width / 2
center.y = bbox.y + bbox.height / 2
```

If OCR returns a better text center, use it as review metadata first. Promote it
to canonical content only after a Core thread approves the contract change.

## Core Decision: Detection Metadata Placement

Detection metadata should live in ingestion artifacts and import/review payloads
first, not in canonical `Series -> Episode -> Page -> Panel -> Bubble` content.

For strict import-result validation, `PageImportResult` and
`ImportedBubbleDraft` may carry an optional `detectionMetadata` object:

- `ocrConfidence`: OCR text confidence from an OCR artifact.
- `detectionConfidence`: Panel/Bubble/text-region detection confidence.
- `textCenter`: OCR text center in page pixel coordinates.
- `detectorRunId`: detector or OCR run id for audit/debug lookup.
- `sourceDetector`: detector, OCR, parser, or provider name.
- `sourceArtifactIds`: artifact ids used to build the review candidate.

`speakerConfidence` remains separate. It describes editorial confidence in the
speaker attribution, not OCR or region-detection confidence.

CMS may display these fields as read-only review metadata. Accepting an import
candidate must copy only reviewed canonical fields into `contents/`; confidence,
run ids, source detector names, artifact ids, and text centers remain outside
canonical content until a later contract change explicitly promotes them.

Future optional data:

- Bubble polygon or mask.
- Text span boxes for line-level quoting or translation alignment.
- Detector run metadata.
- Per-span confidence.

## Immediate vs Deferred

Implement soon:

- Reader Explore mode center targets derived from existing Bubble bboxes.
- Reader selected-state bbox highlight only after selection.
- CMS display of bbox, text, reading order, and warnings.
- Design-only handling for Panel, Bubble, and text-span target roles.

Defer:

- Exact bubble shape cutout.
- Polygon or mask contract changes.
- Text span persistence.
- Reader-visible OCR confidence.
- Any API, schema, or database migration until the Core thread is assigned.

## Thread Handoff Notes

Viewer thread:

- Prototype Explore-mode Bubble center targets using existing bbox data.
- Keep Normal mode overlays hidden.
- Use selected-state bbox highlight only after a Bubble or Panel is selected.

CMS thread:

- Keep Structure Review bbox-first.
- Add non-contract UI affordances for OCR confidence only if the data is already
  present in draft/import payloads.
- Do not add polygon editing for MVP.

Core thread:

- Decide whether detection confidence and text center should live in canonical
  content, ingestion artifacts, or a draft-only review payload.
- Do not add polygon or text-span schema until a concrete Reader/CMS use case
  requires it.
