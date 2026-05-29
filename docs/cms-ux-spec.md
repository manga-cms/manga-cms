# CMS UX Spec

CMS is for creating, reviewing, approving, and publishing structured manga content and packs.
It is separate from Reader, but it must include Reader preview.

## Users

- Creator
- Editor
- Translator
- Translation reviewer
- Footnote reviewer
- Moderator
- Admin

## Required Workspaces

### Content Structure

Manages the canonical hierarchy.

- Series
- Episode
- Page
- Panel
- Bubble

Required functions:

- Page image upload/import
- Panel bbox setup
- Bubble bbox setup
- Reading order setup
- Speaker setup
- Bubble ID confirmation
- Version/revision history

### Page Structure Review

This is the next critical CMS UI.

It should show the page image with overlays:

- draggable panel boxes
- draggable bubble boxes
- reading-order labels
- source text / OCR text / chosen text
- accept/reject buttons for ingestion candidates
- save to canonical draft

The source of initial boxes should be ingestion artifacts. Human confirmation is required before writing canonical content.

### Bubble Editor

Bubble is the main unit for translation, quote, and footnote work.

Display:

- Bubble ID
- page / panel reference
- bbox
- original text
- speaker
- reading order
- current translations
- footnotes
- author/editor comments
- proposals

### Translation Workspace

Translator-focused view.

- Original text
- Current translation
- Translation input
- character voice memo
- glossary
- target language
- text length/fit guidance
- bubble preview
- previous/next panels
- diff from existing translation
- proposal reason
- save / propose / request review

Manga translation cannot be reviewed from text alone. The workspace must show the surrounding page and bubble fit.

### Review Queue

Editor/reviewer queue for proposals.

Proposal types:

- translation
- typo
- footnote
- commentary
- tag
- structure

Actions:

- approve
- reject
- request changes
- merge
- mark duplicate
- escalate to editor

Display:

- current content
- proposed content
- diff
- reason
- contributor
- target page/panel/bubble/region
- surrounding context
- affected pack

### Pack Manager

Packs are additional layers over canonical content.

Pack statuses:

- draft
- in_review
- approved
- published
- deprecated
- archived

Pack types:

- Translation Pack
- Footnote Pack
- Commentary Pack
- Learning Pack
- Accessibility Pack

Pack Manager fields:

- language
- version
- maintainer
- reviewer
- license/rights notes
- spoiler policy
- published_at

### Rights / Role Manager

Controls who can do what by series, episode, language, and pack.

Required controls:

- series owner
- episode editor
- language translator
- translation reviewer
- pack maintainer
- proposal contributor
- moderator
- publisher

## CMS Preview

CMS must embed Reader preview for:

- normal reading
- Study Mode
- footnote marker behavior
- translation comparison
- spoiler behavior
- read-complete card

Preview is required because translation quality and annotation quality depend on reading flow, not only structured data.
