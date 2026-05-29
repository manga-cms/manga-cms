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
  "id": "storyboard-ui-check-ep01-p001",
  "pageNumber": 1,
  "displayRef": "P1",
  "images": {
    "ja": "pages/p001.png"
  },
  "width": 768,
  "height": 1024,
  "panels": []
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

## Panel JSON Shape

```json
{
  "id": "storyboard-ui-check-ep01-p001-k001",
  "panelNumber": 1,
  "bbox": { "x": 400, "y": 60, "width": 320, "height": 220 },
  "reactionTags": [],
  "flags": {
    "shareable": true,
    "feedback_enabled": true
  },
  "bubbles": [
    {
      "id": "storyboard-ui-check-ep01-p001-k001-f001",
      "bubbleNumber": 1,
      "shortId": "p1-k1-f1",
      "bubbleType": "speech",
      "textOriginal": "……",
      "speaker": "uta",
      "textDirection": "vertical",
      "lang": "ja",
      "flags": {
        "shareable": true,
        "feedback_enabled": true
      },
      "bbox": { "x": 560, "y": 100, "width": 120, "height": 120 }
    }
  ]
}
```

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
