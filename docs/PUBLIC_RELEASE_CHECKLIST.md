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
- [x] Explain current project status in README.
- [x] Document the current content format.
- [x] Remove local metadata files from version control if tracked.
- [x] Confirm no obvious real secrets are committed.
- [ ] Confirm sample content is either original, licensed, or clearly placeholder.
- [ ] Create the GitHub repository.
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

## Optional Structured Features

- [ ] Add stable panel IDs.
- [ ] Add stable bubble IDs.
- [ ] Add bubble text and bounding boxes.
- [ ] Add reaction tags to selected panels.
- [ ] Add a translation pack in `packs/`.
- [ ] Add OGP checks for quote and clip pages.

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

## Public Messaging

Use accurate wording when publishing:

- "Open source structured manga CMS" is accurate.
- "Can publish prepared manga images and JSON metadata" is accurate.
- "Ingestion PoC" is accurate.
- "Automatic manga upload and structure extraction" is too strong today.
- "Production-ready paid manga platform" is too strong today.
