# Public Release Checklist

This checklist tracks the work needed to publish the repository on GitHub and to
publish the first real manga content with the current implementation.

## Release Modes

### Open Source Repository

Goal: make the codebase understandable and safe for others to clone, run, and
modify.

Status: nearly ready.

### Free Manga Site

Goal: publish one or more episodes for public reading.

Status: ready if prepared page images and JSON content are available.

### Commercial Manga Site

Goal: sell or gate content for real users.

Status: not ready without more operations work.

## GitHub Repository Launch

- [x] Add an explicit open source license.
- [x] Add contribution guidelines.
- [x] Add issue templates.
- [x] Add security policy.
- [x] Explain current project status in README.
- [x] Document the current content format.
- [x] Document GitHub account and repository naming plan.
- [x] Document next actions and owner split.
- [x] Remove local metadata files from version control if tracked.
- [x] Confirm no obvious real secrets are committed.
- [ ] Confirm sample content is either original, licensed, or clearly placeholder.
- [ ] Create a GitHub Organization or choose the owner account.
- [ ] Create the GitHub repository. Recommended name: `manga-cms`.
- [ ] Add the remote.
- [ ] Push `main`.
- [ ] Add repository topics and a short description.

## First Free Content Launch

- [ ] Choose the first series.
- [ ] Confirm publishing rights for all images and text.
- [ ] Place page images under `contents/{seriesId}/{episodeId}/pages/`.
- [ ] Create `series.json`.
- [ ] Create `episode.json`.
- [ ] Start the API.
- [ ] Start the viewer.
- [ ] Confirm `/api/v1/series` returns the work.
- [ ] Confirm the work detail page renders.
- [ ] Confirm the episode page renders all pages.
- [ ] Add panel and bubble data for quote/clip support if needed.
- [ ] Confirm quote, clip, and reaction routes only if structured data exists.

## Reader MVP UX

- [ ] Implement explicit `normal` reading mode.
- [ ] Implement explicit `study` mode for panel/bubble overlays.
- [ ] Keep panel boxes, bubble boxes, IDs, and annotation controls hidden in normal mode.
- [ ] Add selected Page / Panel / Bubble highlight behavior.
- [ ] Add reader-internal fragment navigation for page and target restore.
- [ ] Add canonical path URLs for quote and clip pages so OGP does not depend on URL fragments.
- [ ] Add Page OGP first.
- [ ] Add a read-complete card at the end of an episode.
- [ ] Store reading progress in localStorage before adding account sync.

## Sharing and Curation MVP

- [ ] Add Share Policy fields to content or derived share records.
- [ ] Add Spoiler Policy fields: `none`, `light`, `major`, `ending`.
- [ ] Add official Quote records.
- [ ] Add official Clip records.
- [ ] Add official Reaction records.
- [ ] Limit public Clip sharing to official Clips at first.
- [ ] Add max panel count for Clips.
- [ ] Add disable/takedown fields for shared units.
- [ ] Add spoiler-free promotion links from official entry points.

## Optional Structured Features

- [ ] Add stable panel IDs.
- [ ] Add stable bubble IDs.
- [ ] Split internal IDs from display refs for pages, panels, and bubbles.
- [ ] Add URL alias resolution for old display refs.
- [ ] Add Edition metadata for web, volume, revised, color, vertical scroll, and international versions.
- [ ] Add bubble text and bounding boxes.
- [ ] Add reaction tags to selected panels.
- [ ] Add use-case tags for reactions, not only emotion tags.
- [ ] Add speaker metadata where available, but keep it optional.
- [ ] Add character quote lists once speaker metadata is reliable.
- [ ] Add a translation pack in `packs/`.
- [ ] Add OGP checks for quote and clip pages.
- [ ] Add local favorite quote/panel save.

## Commercial Launch Gaps

These are intentionally not blockers for open source release or a free public
viewer, but they are blockers for a real paid launch.

- [ ] Replace watermark stub with actual image processing.
- [ ] Add Stripe or Gumroad webhook ingestion.
- [ ] Add reconciliation for delayed or failed payments.
- [ ] Add Redis or equivalent shared rate limiting for multi-instance deploys.
- [ ] Schedule expired magic-link cleanup.
- [ ] Add monitoring, alerting, and error reporting.
- [ ] Decide CDN strategy for free and gated images.
- [ ] Run backup and restore drills against realistic data.
- [ ] Decide long-term OAuth/SSO or session strategy.

## Explicitly Deferred

- [ ] User-generated public Clips.
- [ ] External Embed.
- [ ] Public Community Proposal UI.
- [ ] Contributor Reward payout.
- [ ] Pack Marketplace.
- [ ] Accessibility reading with panel and scene descriptions.
- [ ] Large-scale dynamic OGP generation for every possible shared target.

## Public Messaging

Use accurate wording when publishing:

- "Open source structured manga CMS" is accurate.
- "Can publish prepared manga images and JSON metadata" is accurate.
- "Ingestion PoC" is accurate.
- "Automatic manga upload and structure extraction" is too strong today.
- "Production-ready paid manga platform" is too strong today.
