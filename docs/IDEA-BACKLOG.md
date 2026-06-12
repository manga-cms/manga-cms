# Idea Backlog

This document stores future Manga CMS ideas that are not yet committed
milestones. It is public-facing and follows the same OSS/private boundary as
[`docs/oss-boundary.md`](oss-boundary.md).

Keep ideas in this file provider-neutral unless a future task explicitly moves
implementation details into a private commercial layer.

## Priority Ideas

### 1. Static Publish / Export Target

Export public free Episodes as a fully static published site:

- pre-rendered Reader HTML;
- published JSON and images;
- OGP artifacts, including attribution-bearing Page/Panel/Bubble share cards
  where policy allows;
- manifest files that describe the published artifacts.

Value:

- Makes Manga CMS easier to adopt as a self-hosted publishing engine.
- Allows simple hosting on static platforms.
- Unifies current OGP artifact hardening with a broader published manifest v1
  design, instead of treating OGP as a separate one-off export.

MVP:

- Free public Episodes only.
- No quote / clip / feedback runtime features.
- Export Reader HTML, published JSON, page images, OGP images, and manifest.

Boundary:

- Generic manifest/export concepts are OSS-safe.
- Provider-specific upload, CDN routing, cache rules, custom hostnames, or paid
  gated delivery adapters belong outside the public OSS implementation.

### 2. Attribution-Bearing Share Cards

Generate official share cards for public Page / Panel / Bubble targets with
creator attribution and a canonical source URL.

Value:

- Makes official sharing more useful than unaffiliated screenshots.
- Helps shared fragments carry creator credit and a route back to the source
  Episode.
- Reuses the same public-safety gates as Share URL and OGP artifact work.

MVP:

- Add creator label and source URL to published Page / Panel OGP cards.
- Keep generated images deterministic and public-safe.
- Do not add user-specific marks or reader tracing to the public OSS
  implementation.

Boundary:

- Attribution and provenance are OSS-safe.
- User-specific tracing, reader fingerprinting, leak detection, and forensic
  workflows remain private/commercial-layer work.

### 3. C2PA Content Credentials For Published Artifacts

Attach Content Credentials or similar provenance manifests during publish/export
for public artifacts.

Value:

- Gives creators a standards-based way to state authorship, publication time,
  license terms, and AI-training preferences where supported.
- Does not try to prevent copying; it records provenance and makes stripped
  copies less authoritative than official copies.

MVP:

- Design provider-neutral metadata fields for published artifact provenance.
- Add an optional publish/export step that can be enabled by a self-hoster.
- Keep signing keys and operational key management out of sample data and out
  of default local development.

Boundary:

- Standards-based provenance is OSS-safe.
- Private key operations, hosted signing infrastructure, and commercial
  enforcement workflows are deployment-specific.

### 4. Perceptual Hash Manifest

Include perceptual hashes for published images in the manifest.

Value:

- Creates an official artifact index that can later support manual or private
  monitoring workflows.
- The manifest does not prevent copying and does not identify readers.

MVP:

- Add optional pHash / PDQ-style fields to published artifact manifest design.
- Treat the hashes as derived artifact metadata, not canonical manga content.

Boundary:

- Generating provider-neutral hashes for the publisher's own artifacts is
  OSS-safe.
- Web crawling, matching pipelines, notice generation, and enforcement
  workflows belong outside the public OSS implementation unless documented only
  at a high level.

### 5. One-Command Docker Compose Self-Host

Provide a `docker compose up` path that starts API, Viewer, CMS, and Postgres,
then serves a rights-cleared sample.

Value:

- Reduces the time from clone to first readable manga.
- Makes the project feel like a practical self-hosted engine rather than a
  collection of packages.

MVP:

- Compose file.
- Initialization script.
- Sample content only after rights and license text are complete.

### 6. RSS / Atom Feed

Expose a feed for public Episodes.

Value:

- Gives self-hosted creators a simple reader-retention mechanism.
- Fits the "web publishing engine" model.

MVP:

- A single site-wide `/feed.xml`.
- Public Episodes only.
- Links to canonical Share or Reader URLs.

### 7. Local-First Reading Progress

Store reading progress in `localStorage` without accounts or server sync.

Value:

- Supports "continue reading" without hosted identity.
- Keeps privacy and self-host simplicity.

MVP:

- Record Series / Episode / Page progress locally.
- Show "continue reading" on Reader-facing pages where appropriate.

### 8. Bubble Full-Text Search

Build a derived runtime index from `Bubble.textOriginal` and return search
results that link to quote/share URLs.

Value:

- A structured manga experience that image-only manga sites cannot provide.
- Helps readers find remembered lines.

MVP:

- Opt-in Series-level setting.
- Simple DB-backed search over derived text.
- Rebuildable index; `contents/` remains canonical.

Boundary:

- Search index is derived runtime state, not the canonical content store.
- Because this exposes full text, it should share policy gates with the future
  HTML text layer.

### 9. Storyboard To Draft Episode Flow

Import storyboard images and script text into draft Episodes for early creator
and editor review.

Value:

- Expands Manga CMS from finished manuscript publication into pre-publication
  editorial workflow.
- Builds on Page Structure Review, Script Assist, Proposal workflows, and hidden
  draft visibility.

MVP:

- Draft Episode marked as storyboard-stage content.
- Low-resolution page images.
- Script Assist connection.
- No private or unpublished sample assets committed to the public repository.

## Additional Feature Backlog

### A. Page Thumbnail Progress Grid

Show all Episode Pages as thumbnails with review status badges.

MVP:

- Image thumbnail.
- Panel count.
- Bubble count.
- Pending count.
- Warning count.

### B. Bubble Fit Guidance

Warn translators when draft text is likely too long for the Bubble bbox and
text direction.

MVP:

- Simple text-length-to-bbox-area warning.
- No exact font metric requirement.
- Rendering preview can come later.

### C. Content Lint CLI

Expose content linting as a clear operator-facing command.

Current state:

- `pnpm validate:content` already validates content schemas, content lint
  warnings, and Pack target references when public content exists.

Future improvement:

- Add optional JSON output.
- Document it as the stable `manga-cms lint` style workflow if a CLI wrapper is
  introduced.

### D. Accessibility Pack / Read-Aloud Export

Generate a structured text page or export in Page -> Panel -> Bubble reading
order.

Value:

- Directly expresses the accessibility value of structured manga.

MVP:

- Episode-level static text page.
- Include `textOriginal`, speaker where available, and `bubbleType`.
- Respect text exposure policy.

### E. Reaction Panel Embed

Expose selected shareable Panels as lightweight embed cards with cropped image
and source link.

MVP:

- Static Panel OGP crop or published artifact.
- Copy-paste HTML snippet.
- Always pass share policy and public-safety gates.

### F. Pack Directory Metadata

Define registry-compatible Pack metadata in the OSS layer while leaving hosted
distribution outside the public repository.

MVP:

- Compatibility metadata such as schemaVersion and target content hash.

Boundary:

- Pack metadata is OSS-safe.
- Hosted Pack distribution, marketplace operations, payments, and revenue
  sharing belong to the private commercial layer.

### G. Ingestion Confidence Heatmap

Show candidate confidence as a page overlay to help editors focus on uncertain
regions first.

MVP:

- Confidence threshold filter.
- Low-confidence candidates visually emphasized.
- Confidence remains ingestion runtime/review metadata until confirmed.

### H. Publish Webhook

Emit provider-neutral webhooks when a draft is confirmed or content is
published.

MVP:

- URL + HMAC signature.
- Generic event payload.

Boundary:

- OSS provides the generic extension point.
- Provider-specific cache purge, CDN invalidation, and hosted automation belong
  outside the public OSS implementation.

### I. Feedback To Translation Fix Shortcut

Let a self-hosted editor turn a translation feedback item into a Pack Draft
change from one screen.

MVP:

- Use existing feedback -> proposal -> adopt proposal flow.
- Keep reviewability; do not silently mutate canonical content.

## Private / Commercial-Layer Ideas

The following ideas may be useful for hosted commercial operations, but they
should not be implemented or specified in detail in the public repository:

- delivery or typesetting-level reader deterrence;
- approved translation variant delivery by entitlement bucket;
- reader/session-specific visible UI marks;
- scraper behavior detection and response workflows;
- paid-content leak tracing, forensic workflows, or enforcement automation.

If public docs mention these, keep them at the level of "private commercial
platform work" and do not include algorithms, thresholds, identifiers, or
operational recipes.
