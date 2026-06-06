# Reader UX Spec

Reader is for reading, sharing, viewing approved packs, and making lightweight proposals.
It must not become the primary editing surface.

## Principle

- Normal reading must prioritize the manga page.
- Structure IDs, translation diffs, footnotes, and editing controls are hidden by default.
- Reader may expose proposal entry points, but canonical editing and approval happen in CMS.
- CMS must include Reader preview so creators can judge how packs feel while reading.

## Modes

### Normal Mode

Default mode for readers.

- Show pages with minimal chrome.
- Do not show footnotes, translation diffs, bubble IDs, panel IDs, or proposal forms.
- Allow page navigation, read progress, and share entry points.
- If a page/panel/bubble has approved footnotes, show only a small unobtrusive marker.

### Study Mode

Opt-in mode for readers, translators, and reviewers.

- Show original text, translation text, approved footnotes, and author/commentary packs.
- Allow lightweight translation or footnote proposals.
- Show target context: page, panel, bubble, or selected region.
- Keep proposal UI outside the manga image unless the user explicitly opens it.

## Footnote UI

Footnotes have three display levels.

| Level | Behavior | Use |
|-------|----------|-----|
| 0 | Hidden | Normal reading |
| 1 | Small marker only | Indicates available context without interrupting reading |
| 2 | Bottom sheet or popover | Opened by tap/click/long-press |

Footnote markers should be small, such as `*` or `i`, and should not cover the artwork or text.

## Footnote Types

| Type | Meaning | Reader policy |
|------|---------|---------------|
| `language` | Words, phrasing, idioms | OK in Study Mode and lightweight markers |
| `culture` | Culture, customs, background | OK in Study Mode and lightweight markers |
| `story` | Story or setting explanation | Cautious display; may require spoiler policy |
| `production` | Creator/editor production note | Prefer read-complete or Study Mode |
| `spoiler` | Spoiler analysis | Hidden until read-complete or explicit opt-in |

## Translation UI

Reader translation UI is split by reader intent.

### Casual Reading

- Language switch only.
- Prefer rendered page images by locale when available.
- Do not show translation diffs.

### Study Mode

- Show original and translation side by side.
- Allow lightweight proposal:
  - target
  - current translation
  - proposed translation
  - reason
  - nuance
  - character voice

### Translation Comparison

Translation comparison is useful but should be Study Mode or read-complete only.

Example:

- Japanese original
- English translation
- Spanish translation
- Proposal entry point

## Proposal Entry Points

Reader proposals are lightweight.

- Propose translation
- Report mistranslation or typo
- Propose footnote
- Propose region/context

Reader proposals go to Proposal Queue. They do not modify canonical content or published packs directly.

## Target Granularity

Reader proposal targets should support four levels.

| Target | Purpose |
|--------|---------|
| Page | broad note, page-level context, layout issue |
| Panel | scene-level note or reaction context |
| Bubble | translation, wording, speaker, idiom, typo |
| Region | fallback when panel/bubble structure is missing |

Page-only proposals are acceptable for MVP, but bubble and panel targets are required for strong translation and footnote workflows.

Canonical content v2 stores `Page.panels[]` and `Page.bubbles[]` as sibling
arrays. Reader implementations should resolve Bubble context through
`bubble.panelId`; `panelId: null` means the Bubble is page-level or not yet
attached to a Panel. Reader-facing labels should use `displayRef` when present,
while stable links should use `pageId`, `panelId`, and `bubbleId`.

## Reader To CMS Flow

```text
Reader
  -> proposal
  -> Proposal Queue
  -> CMS review
  -> approved Pack
  -> published Reader display
```

## Non-Goals

- Reader is not the primary panel/bubble editor.
- Reader does not publish packs.
- Reader does not grant translation or commercial rights.
- Reader does not bypass entitlement or spoiler policy.
