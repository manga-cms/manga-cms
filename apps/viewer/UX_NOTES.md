# Viewer / Reader UX Notes

This note is Viewer-specific. It does not change API, schema, database, or
shared domain contracts.

## Official Site Home

`SITE_MODE=official` should present `manga-cms.com` as the OSS official site.
The first viewport should explain the project and expose these paths:

- GitHub: source, setup, and contribution entry.
- Demo: public-safe sample reader entry. Until sample rights are confirmed,
  show a preparation state and do not use local fixtures.
- Showcase: curated examples only, not public submissions.
- Creators: curated pilot intake by email/form and manual review.
- Docs: gateway to repository docs, API contract, and content guide.
- Roadmap: public release status and deferred platform work.

`/works` is not a primary official-site route. It remains available for
`SITE_MODE=serial`, where the home page is reading-first and routes readers to
Series, Episode, and Reader pages.

## Reader Target Selection

Feedback targets use existing Reader data only:

- Page: default on mobile and the safest target when the reader only taps the
  normal-mode report action.
- Panel: selectable in Explore mode from existing Panel bbox.
- Bubble: selectable in Explore mode from Bubble bbox center target; selected
  Bubble shows a subtle bbox highlight.
- Region: local-only anchor stored with the page note. It is represented as a
  Page feedback target plus a source URL region query until the contract grows a
  first-class region payload.

When the reader asks to pick Panel, Bubble, or Region on a small screen, hide the
bottom sheet temporarily and show the whole page. Tapping a target restores the
detail panel with the selected target.

Do not expose OCR/detection confidence in Reader. Detection metadata belongs to
import/review surfaces until a Core thread promotes it.

Normal reading should not depend on a persistent target overlay toggle. A center
tap opens the Reader chrome, page scrubber, and temporary Page / Panel / Bubble
targets together. If the reader does not pick a target, those targets disappear
with the chrome. Selecting a target opens the existing action sheet and keeps it
open until the reader acts or closes it.

Reader display settings live behind the gear menu for now: UI language, light /
dark, and single / spread layout. If future Translation Packs or localized page
images become reader-facing, add a separate content-language selector back to a
more prominent Reader surface; do not conflate it with the UI locale setting.

## Deep Link UX

Page deep links should open directly to the requested page. If the reader lands
on `#pN` or a target focus URL, show a small "最初から読む" action. It should be
secondary: useful for orientation, but not a modal or blocker.

Focus links for Panel/Bubble may enter Explore mode because the target context
is the point of the link. Page-only links should stay in the current reading
mode and only update the active page.

## Share UX

Use a layered share fallback:

1. Web Share API when available.
2. Service links for X, LINE, and Bluesky.
3. URL copy when service sharing is unavailable or canceled.

Share targets:

- Episode: base episode URL.
- Page: page URL using `#pN` and/or `?page=page_id`.
- Panel: focus URL with `focus=panel_id`.
- Bubble: focus URL with `focus=bubble_id`.
- Clip: design-only for now; use Panel/Region URLs until Clip creation exists.

## OGP UX

Do not implement heavy OGP image generation in Viewer. Use the existing
`shareImageUrl` / cover / placeholder fallback rules. For future Panel/Bubble
OGP, prefer API-generated images so protected raw origin paths never leak.
