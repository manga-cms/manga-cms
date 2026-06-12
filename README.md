# Manga CMS

Open source infrastructure for publishing structured manga on the web.

Manga CMS is for creators, publishers, translation teams, and accessibility
teams who want manga pages to remain beautiful images while also becoming
addressable, searchable, and extensible content.

Most manga sites publish a page as one flat image. Manga CMS keeps the page
image, then adds a stable structure layer:

```text
Series
  -> Episode
    -> Page
      -> Panel
        -> Bubble
```

That structure creates reader-facing value immediately:

- **Quote sharing:** link to the exact speech bubble or panel range instead of
  sending someone to a whole page and asking them to find the moment.
- **Translation Packs:** add approved translations, notes, learning material,
  or commentary without rewriting the original manga source.
- **Accessibility:** preserve reading order and structured text so assistive
  technology, alternate displays, and future accessibility packs have a
  dependable content model.

<!-- screenshot: page-structure-review -->

Try the full stack with Docker Compose:

> The default Compose stack is for local demos only. It binds services to
> `127.0.0.1` and uses development secrets; do not expose it directly to the
> internet.

```bash
docker compose up --build
```

Then open the reader, creator CMS, or API health check:

- Reader: <http://localhost:4321>
- CMS: <http://localhost:5173>
- API: <http://localhost:3000/api/v1/health>

<!-- screenshot: reader-quote-share -->
<!-- screenshot: cms-structure-editor -->

## Status

This repository is ready for public open source iteration, while some workflows
are still early and intentionally visible.

Works today:

- Read structured manga through an Astro public viewer.
- Serve series, episodes, pages, quotes, clips, reactions, auth, delivery,
  entitlements, and admin workflows from a Hono API.
- Edit basic series and episode metadata in the React creator CMS.
- Store canonical manga source data in file-backed `contents/` with Zod
  validation.
- Use Prisma-backed runtime state for database mode.
- Deliver tokenized images with entitlement checks.
- Review ingestion drafts through a proof-of-concept draft/review/confirm flow.

Still early:

- CMS image upload needs more production workflow hardening.
- Panel and bubble editing exists only in a minimal form.
- OCR, PSD, and Clip Studio ingestion remain proof-of-concept work.
- Published asset strategy, monitoring, and multi-instance operations need more
  hardening.
- External commerce integrations are outside the current OSS deliverable.

For the launch checklist and project direction, see [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md)
and [ROADMAP.md](ROADMAP.md).

## Why Structured Manga

Structured manga separates the reading image from the content references around
it. A reader still sees the page as manga, but the system can resolve stable IDs
for pages, panels, and bubbles. Those IDs make quote pages, clip pages,
translation packs, proposals, review tools, and entitlement checks less fragile
than coordinate-only overlays.

Accessibility work benefits from the same structure. Reading order, structured
text, and explicit bubble boundaries give screen readers and alternate reading
experiences a better source than flattened artwork alone. In Europe, the
European Accessibility Act places accessibility expectations on many digital
products and services; this project keeps that context in mind without claiming
legal compliance by default.

## Quick Start

Requirements:

- Docker with the Compose plugin

Run the local stack:

> The default Compose stack is for local demos only. It binds services to
> `127.0.0.1` and uses development secrets; do not expose it directly to the
> internet.

```bash
docker compose up --build
```

Default local URLs:

- Reader: <http://localhost:4321>
- CMS: <http://localhost:5173>
- API health: <http://localhost:3000/api/v1/health>

The Compose stack starts PostgreSQL, the Hono API, the Astro viewer, and the
React CMS. It mounts local content directories such as `contents/` and `packs/`
so you can inspect the source files while the services run.

## Developer Setup

Use the pnpm workflow when you want package-level builds, linting, or focused
app development outside Docker.

Requirements:

- Node.js 20 or newer
- pnpm 9.5.0

Install and build:

```bash
pnpm install
pnpm --filter @manga/db db:generate
pnpm build
```

Run the API:

```bash
cd apps/api
pnpm dev
```

Default API health endpoint:

```text
http://localhost:3000/api/v1/health
```

Run the viewer:

```bash
cd apps/viewer
API_BASE=http://localhost:3000/api/v1 pnpm dev
```

Default viewer:

```text
http://localhost:4321
```

Run the CMS:

```bash
cd apps/cms
pnpm dev
```

If the API is not running on port 3000, set the CMS proxy target:

```bash
API_PROXY_TARGET=http://localhost:3100 pnpm dev
```

Default CMS:

```text
http://localhost:5173
```

## Repository Layout

```text
apps/
  api/       Hono API server
  cms/       React + Vite creator CMS
  viewer/    Astro public viewer

packages/
  db/         Prisma schema and database repository layer
  domain/     shared domain types and filesystem repositories
  ingestion/  ingestion PoC package
  schemas/    Zod schemas for content and pack validation

contents/     manga source data
packs/        translation/commentary/learning/accessibility packs
docs/         launch, deployment, and operations docs
scripts/      smoke tests and local runners
```

`contents/` and `packs/` are the canonical editorial source for manga content
and Pack manifests. Runtime database rows may reference or index that content,
but they are not the canonical manga content store.

## Publishing Manga Content

The most reliable path today is to add content files manually or through the
current CMS publish flow.

This repository is intended to publish source code, schemas, and documentation.
Manga images, story text, translations, and other creative content are not
covered by the Apache-2.0 code license unless they are explicitly marked as
sample content with their own license. The default policy is to keep real or
local verification content untracked.

Before adding tracked sample manga content, use
[docs/SAMPLE-CONTENT-CHECKLIST.md](docs/SAMPLE-CONTENT-CHECKLIST.md).

Minimum required structure:

```text
contents/
  your-series/
    series.json
    ep01/
      episode.json
      pages/
        p01.jpg
        p02.jpg
```

Pages can render with an empty `panels` array. Quote, clip, reaction,
translation, and annotation features require panel and bubble data.

See [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) for the current content
format and publication workflow.

## License And Content Rights

The source code and project documentation are licensed under the Apache License
2.0. See [LICENSE](LICENSE).

Manga content is separate:

- real manga artwork, story text, lettering, and translations must have their
  own rights clearance;
- local verification content should stay ignored by Git;
- tracked public sample content must clearly state its license;
- using this code does not grant rights to any manga content outside this
  repository.

## Core Concepts

### Reader, CMS, And Rights

Reader, CMS, and Rights are separate product surfaces.

- Reader is for reading, sharing, approved pack display, and lightweight proposals.
- CMS is for structure editing, proposal review, pack management, publishing, and Reader preview.
- Rights controls who can propose, edit, review, publish, and use content by series, language, pack, and usage.

This separation keeps the reading experience clean while still allowing translation, footnote, and structure work to move through review.

### Stable IDs

Pages, panels, and bubbles have stable IDs. These IDs let the system resolve
deep links, quote pages, clip pages, packs, proposals, and entitlement checks
without depending on fragile screen coordinates alone.

### Packs

Packs add information without rewriting the original manga content.

Supported pack categories include:

- Translation
- Footnote
- Commentary
- Learning
- Accessibility

### Entitlements

Access control is based on entitlements rather than purchase records alone.
The OSS engine includes basic entitlement primitives for self-hosted access
control. Commercial payment fulfillment, refunds, disputes, purchase recovery,
reconciliation, payouts, and revenue-sharing operations are private/commercial
platform work, not part of the public OSS deliverable.

### Ingestion

The ingestion pipeline is designed to reduce manual structuring work, not to
fully automate editorial judgment. The intended flow is:

```text
Images / PSD / text export
  -> panel and text-region candidates
  -> OCR/source-text matching
  -> draft JSON
  -> CMS review
  -> contents/ source of truth
```

## Documentation

- [Roadmap](ROADMAP.md)
- [OSS boundary](docs/oss-boundary.md)
- [Architecture layer boundary](docs/architecture/layer-boundary.md)
- [Production ops checklist](docs/production-ops-checklist.md)
- [API contract](docs/api-contract.md)
- [Rights and permission spec](docs/rights-permission-spec.md)
- [Ingestion specification](ingestion-spec.md)
- [Content guide](docs/CONTENT_GUIDE.md)
- [Reader UX spec](docs/reader-ux-spec.md)
- [Reader feedback MVP spec](docs/feedback-mvp-spec.md)
- [CMS UX spec](docs/cms-ux-spec.md)
- [Translation governance spec](docs/translation-governance-spec.md)
- [Rights and permission spec](docs/rights-permission-spec.md)
- [Storyboard data import](docs/storyboard-data-import.md)
- [Launch checklist](docs/LAUNCH-CHECKLIST.md)
- [Production ops checklist](docs/production-ops-checklist.md)
- [Deployment](docs/DEPLOY.md)
- [Backup and restore](docs/BACKUP-RESTORE.md)

## Contributing

Contributions are welcome. The most useful areas right now are:

- Content format examples and validation.
- CMS UX for page, panel, and bubble editing.
- Manuscript ingestion from image, PSD, text export, and Clip Studio workflows.
- Viewer interactions such as highlighting, zoom, and deep links.
- Accessibility, localization, and translation workflows.

See [CONTRIBUTING.md](CONTRIBUTING.md).

For security-sensitive issues, see [SECURITY.md](SECURITY.md).

## License

Apache License 2.0 for source code and project documentation. Manga content,
if any is added later, must carry its own license.

## Vision

The long-term goal is to create an open publishing layer for comics.

A system where:
- creators control their content;
- readers can interact with stories;
- communities can build translation and commentary layers.

Comics should not be static images.

They should be living narrative systems.

If you want to build a manga site, fork this repository and start creating.
