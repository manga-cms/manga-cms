# Content Guide

This guide describes the current reliable path for publishing manga content with
Manga CMS.

The system can publish real manga pages today if the content is already prepared
as images plus JSON metadata. Automated manuscript ingestion is still a PoC.

## Minimum Directory Structure

```text
contents/
  my-series/
    series.json
    ep01/
      episode.json
      pages/
        p01.jpg
        p02.jpg
```

`series.json` describes the work. Each `episode.json` describes pages, images,
panels, and bubbles for one episode.

## Minimal `series.json`

```json
{
  "id": "my-series",
  "title": "My Series",
  "description": "Short description.",
  "status": "ongoing",
  "cover": "cover.jpg",
  "episodes": ["ep01"]
}
```

Supported `status` values:

- `ongoing`
- `completed`
- `hiatus`

## Minimal `episode.json`

This is enough to render pages:

```json
{
  "id": "ep01",
  "episodeNumber": 1,
  "title": "Episode 1",
  "publishedAt": "2026-01-01",
  "pages": [
    {
      "id": "my-series-ep01-p01",
      "pageNumber": 1,
      "images": {
        "ja": "pages/p01.jpg"
      },
      "width": 1200,
      "height": 1800,
      "panels": []
    }
  ]
}
```

With only page data, the viewer can show the manga. Quote, clip, reaction,
translation, and annotation features need panel and bubble data.

## Panel and Bubble Data

Panel and bubble coordinates are stored as bounding boxes in page coordinates.

```json
{
  "id": "my-series-ep01-p01-k01",
  "panelNumber": 1,
  "bbox": {
    "x": 0,
    "y": 0,
    "width": 1200,
    "height": 800
  },
  "reactionTags": ["surprised"],
  "bubbles": [
    {
      "id": "my-series-ep01-p01-k01-f01",
      "bubbleNumber": 1,
      "shortId": "1-1-1",
      "bubbleType": "speech",
      "textOriginal": "Where am I?",
      "speaker": "Hero",
      "bbox": {
        "x": 120,
        "y": 80,
        "width": 300,
        "height": 120
      }
    }
  ]
}
```

Supported `bubbleType` values:

- `speech`
- `thought`
- `narration`
- `sfx`

## Feature Requirements

| Feature | Required data |
| --- | --- |
| Basic page reading | page images and page metadata |
| Episode navigation | `series.json` plus episode manifests |
| Quote page | target bubble data |
| Clip page | target panel range |
| Reaction search | `reactionTags` on panels |
| Translation pack | stable bubble or panel IDs |
| Entitlement-gated delivery | API, auth, entitlement setup, and page images |

## Image Files

The current local workflow serves images from paths referenced in `episode.json`.

For this page entry:

```json
"images": {
  "ja": "pages/p01.jpg"
}
```

the image should exist at:

```text
contents/my-series/ep01/pages/p01.jpg
```

## CMS Workflow

The CMS can create and edit series and episodes, but image upload and rich
panel/bubble editing are not complete yet. For now, the most reliable workflow is:

1. Put page images in `contents/{seriesId}/{episodeId}/pages/`.
2. Create or edit `series.json`.
3. Create or edit `episode.json`.
4. Start the API and viewer.
5. Confirm the series list, work detail page, and episode page render.
6. Add panel and bubble data when quote/clip/reaction features are needed.

## Ingestion Workflow

The ingestion package models this future workflow:

```text
raw pages / PSD / text export
  -> candidates and confidence metadata
  -> canonical draft
  -> CMS review
  -> contents/ source data
```

At the moment, treat ingestion as a PoC and validation tool, not as the only
publication path.

## Rights Checklist

Before committing real manga content:

- Confirm that the artwork, story, translation, and lettering can be published.
- Keep unpublished client or collaborator manuscripts out of public branches.
- Do not commit private purchase records, user data, or production databases.
- Use placeholder content if rights are unclear.
