# Storyboard Data Import

This project separates manuscript/story structure from physical viewer pages.

## Numbering Rule

Use these two IDs separately:

- `pageNumber`: physical image page in the viewer. This must match the actual PNG/JPG order.
- `displayRef`: human-facing storyboard/script label such as `P1`, `P2-a`, or `P7-b`.

Do not force script pages (`P1` to `P12`) to match physical image pages (`1` to `21`).
One script page can span multiple viewer pages.

## Recommended Mapping

For the current storyboard outline, use this mapping style:

| Script ref | Physical viewer pages | Notes |
| --- | --- | --- |
| `P1` | `1` | Introduction |
| `P2` | `2-3` | Page / Panel / Bubble IDs |
| `P3` | `4-5` | Quote sharing |
| `P4` | `6-7` | Screenshot vs contextual share |
| `P5` | `8-9` | Clip sharing and spoiler guard |
| `P6` | `10-11` | Translation Pack |
| `P7` | `12-13` | Reader proposals |
| `P8` | `14-15` | Proposal review and Pack merge |
| `P9` | `16-17` | Footnotes, comments, and Packs |
| `P10` | `18-19` | Normal Mode and Study Mode |
| `P11` | `20-21` | OSS reuse |
| `P12` | `22+` | Summary, if an additional page is provided |

If the exported images stop at page 21, `P12` is still script material but not yet a physical viewer page.

## Canonical Page Shape

Each physical page remains a normal canonical `Page`:

```json
{
  "schemaVersion": 2,
  "pageId": "storyboard-ui-check-ep01-p001",
  "stableRef": "storyboard-ui-check-ep01-p001",
  "pageNumber": 1,
  "displayRef": "P1",
  "images": {
    "ja": "pages/p001.png"
  },
  "imageId": "storyboard-ui-check-ep01-p001:ja",
  "imageHash": "sha256:...",
  "coordinateSpace": "pixel",
  "width": 768,
  "height": 1024,
  "panels": [],
  "bubbles": []
}
```

For split script pages, keep physical order and repeat or suffix the display ref:

```json
[
  { "pageNumber": 2, "displayRef": "P2-a" },
  { "pageNumber": 3, "displayRef": "P2-b" }
]
```

## Panel Data Flow

The safest flow is:

1. Import page images as physical pages.
2. Assign `displayRef` from the script mapping.
3. Apply a CMS panel template, such as `2 / 1 / 2`.
4. Manually adjust panel boxes in CMS.
5. Add bubble boxes and original text.
6. Save canonical `episode.json`.
7. Publish/reload so Reader focus links and feedback can target the structures.

## Prepared Directory Import

The API supports a local-only prepared asset intake endpoint:

```http
POST /api/v1/admin/ingestion/import/prepared-directory
```

The endpoint reads `sourceDir` relative to the API server `IMPORTS_DIR`, copies
supported page images into draft asset storage, and creates an ingestion draft
job. It does not write canonical `contents/` data until the job is reviewed and
confirmed.

Minimal request:

```json
{
  "sourceDir": "rain-world/ep01/pages",
  "seriesId": "rain-world",
  "seriesTitle": "Rain World",
  "episodeId": "ep01",
  "episodeNumber": 1,
  "episodeTitle": "Rain Ruins",
  "defaultWidth": 768,
  "defaultHeight": 1024
}
```

If `pages` is omitted, image files in `sourceDir` are sorted by filename and
mapped to `pages/p001.png`, `pages/p002.png`, and so on. For explicit storyboard
labels, pass `pages[].displayRef`.

The CMS `New Ingestion Job` screen can send the same `pages` mapping through the
optional `Page Manifest JSON` field. Keep this manifest local unless the source
assets are cleared for the public repository.

## CMS Script Assist

`Page Structure Review` has a lightweight Script Assist field for the selected panel.
Paste dialogue or SFX lines and click `Add as bubbles`.

Accepted line examples:

```txt
うた「……」
コンコン「今読んでるビューアーのこと、知りたい？」
《ピカッ》
ナレーション「ページの中に閉じていた漫画が」
```

The CMS converts these into provisional Bubble records:

- `speaker` comes from the text before `「...」`
- `textOriginal` comes from inside the quotes
- `《...》` becomes `bubbleType: "sfx"`
- unknown/plain lines become `bubbleType: "narration"`

The imported boxes are only initial candidates.
Reviewers must still adjust the bubble bbox before saving canonical content.

## Panel And Bubble JSON Shape

```json
{
  "panelId": "storyboard-ui-check-ep01-p001-k001",
  "stableRef": "storyboard-ui-check-ep01-p001-k001",
  "displayRef": "p1-k1",
  "status": "active",
  "panelNumber": 1,
  "bbox": {
    "x": 400,
    "y": 60,
    "width": 320,
    "height": 220,
    "imageId": "storyboard-ui-check-ep01-p001:ja",
    "coordinateSpace": "pixel"
  },
  "reactionTags": []
}
```

Bubbles are stored in `Page.bubbles`, not under `Panel.bubbles`:

```json
{
  "bubbles": [
    {
      "bubbleId": "storyboard-ui-check-ep01-p001-k001-f001",
      "panelId": "storyboard-ui-check-ep01-p001-k001",
      "stableRef": "storyboard-ui-check-ep01-p001-k001-f001",
      "displayRef": "p1-k1-f1",
      "status": "active",
      "bubbleNumber": 1,
      "bubbleType": "speech",
      "textOriginal": "……",
      "speaker": "uta",
      "textDirection": "vertical",
      "lang": "ja",
      "flags": {
        "shareable": true,
        "feedback_enabled": true
      },
      "bbox": {
        "x": 560,
        "y": 100,
        "width": 120,
        "height": 120,
        "imageId": "storyboard-ui-check-ep01-p001:ja",
        "coordinateSpace": "pixel"
      }
    },
    {
      "bubbleId": "storyboard-ui-check-ep01-p001-page-sfx001",
      "panelId": null,
      "stableRef": "storyboard-ui-check-ep01-p001-page-sfx001",
      "displayRef": "p1-page-sfx1",
      "bubbleNumber": 2,
      "bubbleType": "sfx",
      "textOriginal": "ザーッ",
      "bbox": {
        "x": 80,
        "y": 48,
        "width": 160,
        "height": 64,
        "imageId": "storyboard-ui-check-ep01-p001:ja",
        "coordinateSpace": "pixel"
      }
    }
  ]
}
```

Existing draft or legacy JSON with nested `panel.bubbles` must be migrated by
moving those records into `Page.bubbles` and filling `bubble.panelId` with the
owning `panelId`. Page-level text can use `panelId: null`.

Helper:

```bash
node --experimental-strip-types scripts/migrate-content-v2.ts contents --write
```

Omit `--write` for a dry run.

## Script Import Target

The Markdown outline should not be stored directly as canonical content.
Convert it into candidate data first:

- `script_ref`: `P1`, `P2-a`, etc.
- `physical_page`: `1`, `2`, etc.
- `panel_number`
- `scene_description`
- `speaker`
- `text_original`
- `bubble_type`

Then the CMS reviewer confirms panel and bubble positions before it becomes canonical `contents/` data.

## PSD / PSB Text Layer Import Spike

This import path is a technical spike for reviewable Bubble drafts, not a
fully automatic manuscript parser. The importer reads Photoshop text layers and
produces candidate Bubble drafts that a CMS reviewer must attach to Panels,
correct bounds, set type/speaker metadata, and confirm before canonical
`contents/` is written.

Non-goals for this spike:

- Panel auto extraction
- OCR
- VLM-based interpretation
- OpenCV processing
- `.clip` parsing

### Parser Candidate Comparison

| Candidate | Node status | PSD/PSB | Text content | Layer name | Bounds | Visibility | Group path | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@webtoon/psd` `0.4.0` | Modern ESM, TypeScript declarations, zero runtime dependencies | README and type declarations explicitly target PSD and PSB | `Layer.text` | `Layer.name` | `left`, `top`, `width`, `height` | `Layer.isHidden` | Tree exposes `Group.children`; importer can accumulate group names | Best spike candidate. Group hidden state is not exposed on the typed `Group` API, so only layer hidden state is captured for now. |
| `psd` / PSD.js `3.4.0` | Older CommonJS package with CoffeeScript runtime dependency | README focuses on PSD | Exported tree includes text data when type tool metadata is parsed | Exported tree includes `name` | Exported tree includes `left`, `top`, `right`, `bottom`, `width`, `height` | Exported tree includes `visible` | Tree traversal/path helpers exist | Mature API for PSD tree export, but older dependency stack and unclear PSB support make it a fallback candidate. |

### Implemented Spike

`packages/ingestion/src/psd/webtoon-psd-spike.ts` contains a Node-oriented
spike around `@webtoon/psd`. It intentionally uses dynamic import so normal
repository builds do not require adding a PSD parser dependency or changing the
root lockfile during this investigation.

After installing the parser in a local branch or throwaway environment, run:

```bash
pnpm --filter @manga/ingestion build
node --experimental-strip-types scripts/spike-psd-text-layers.ts /path/to/page.psd
```

The output validates as `PageImportResult` and includes:

- `textOriginal`
- `layerName`
- `bbox` from layer bounds when width and height are positive
- `visible` from layer hidden state
- `groupPath`
- `stableRef`

`stableRef` must not depend on layer traversal index. The spike prefers the PSD
layer ID when `@webtoon/psd` exposes `additionalProperties.lyid.value`. If no
layer ID is present, it hashes the source file, group path, layer name, text,
and bounds. This keeps reorder-only changes from rewriting draft identities
when a layer ID is available.

### Import Result Shape

The minimal shared type is `PageImportResult` with `ImportedBubbleDraft[]`.
It is separate from canonical `Page -> Panel -> Bubble` data because PSD text
layers do not prove Panel membership or editorial metadata.

Canonical source locations:

- TypeScript: `packages/domain/src/ingestion-types.ts`
- Zod: `packages/schemas/src/import-result.ts`
- OpenAPI components: `ImportedBubbleDraft` and `PageImportResult`

Importer implementations should import these shared definitions instead of
creating parser-local schemas with the same names.

`PageImportResult` and each `ImportedBubbleDraft` may carry optional
`detectionMetadata` for CMS review. This metadata is draft-only and is not part
of canonical `Page`, `Panel`, or `Bubble` content:

- `ocrConfidence`: OCR text confidence.
- `detectionConfidence`: region or Bubble detection confidence.
- `textCenter`: OCR text center in page pixel coordinates.
- `detectorRunId`: detector or OCR run id for audit/debug lookup.
- `sourceDetector`: detector, OCR, parser, or provider name.
- `sourceArtifactIds`: artifact ids used to build the review candidate.

Do not write these values into `speakerConfidence`. `speakerConfidence`
describes only whether the speaker attribution is confirmed, inferred, or
unknown.

```json
{
  "sourceFile": "imports/storyboard/page-001.psd",
  "parser": "@webtoon/psd",
  "parserVersion": "0.4.0",
  "pageNumber": 1,
  "displayRef": "P1",
  "width": 768,
  "height": 1024,
  "bubbles": [
    {
      "stableRef": "psd-layer:abc123",
      "source": "psd_text_layer",
      "textOriginal": "今日は雨だね",
      "layerName": "bubble-copy",
      "groupPath": ["P1", "Panel A"],
      "visible": true,
      "bbox": { "x": 120, "y": 80, "width": 220, "height": 96 },
      "bubbleType": "speech",
      "speakerConfidence": "unknown",
      "sourceLayerId": "42",
      "detectionMetadata": {
        "ocrConfidence": 0.91,
        "detectionConfidence": 0.84,
        "textCenter": { "x": 230, "y": 128 },
        "detectorRunId": "detect-2026-06-03T10-20-00Z",
        "sourceDetector": "ocr-review-spike",
        "sourceArtifactIds": ["ocr-p001-001", "bubble-region-p001-001"]
      }
    }
  ],
  "warnings": [],
  "unsupported": [
    "Panel extraction is intentionally not attempted.",
    "OCR, VLM, OpenCV, and CLIP parsing are intentionally not attempted."
  ]
}
```

Current limitations:

- No repository PSD/PSB fixture is committed, so automated tests cover schema
  and stable reference behavior rather than parsing a binary fixture.
- `@webtoon/psd` layer visibility is captured, but group visibility needs
  additional verification against real storyboard files.
- Text style, font, and vertical writing metadata are available through parser
  internals, but this spike does not promote them into canonical draft fields
  until real source files confirm the shape is stable enough.
- Detection metadata is kept for import/CMS review only. Canonical content
  writers should drop it unless a later contract explicitly promotes a field.
