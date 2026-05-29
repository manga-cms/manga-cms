# Manga CMS

Open source infrastructure for publishing structured manga on the web.

Manga CMS treats a manga episode as more than a stack of page images. It keeps
stable references for pages, panels, and speech bubbles so the same content can
support precise sharing, translation packs, annotations, access control, and
future ingestion tooling.

## Status

This repository is ready for public open source iteration, but it is still an
early project.

Works today:

- Public manga viewer powered by Astro.
- Hono API for series, episodes, pages, quotes, clips, reactions, auth, delivery,
  entitlements, and admin workflows.
- React creator CMS for basic series and episode editing.
- File-backed `contents/` source data with Zod validation.
- Prisma-backed runtime state for DB mode.
- Tokenized image delivery path and entitlement checks.
- Ingestion proof of concept with draft/review/confirm separation.

Still early:

- Image upload from the CMS is not a complete production workflow.
- Panel and bubble editing is still minimal.
- OCR, PSD, and Clip Studio ingestion are PoC-level.
- Watermark compositing is currently a stub.
- External commerce webhooks, CDN strategy, monitoring, and multi-instance
  hardening are not finished.

For the detailed task list, see [docs/PUBLIC_RELEASE_CHECKLIST.md](docs/PUBLIC_RELEASE_CHECKLIST.md)
and [docs/ROADMAP.md](docs/ROADMAP.md).

## Why This Exists

Most manga websites treat comics as flat images. Manga CMS keeps the image
reading experience, but adds a structured layer:

```text
Series
  Episode
    Page
      Panel
        Bubble
```

That structure enables:

- Quote sharing at the speech-bubble level.
- Clip sharing across panel ranges.
- Reaction search for reusable panels.
- Translation, commentary, learning, and accessibility packs.
- Entitlement-based access control for free, paid, promo, and contributor access.
- A future ingestion pipeline that turns raw manuscripts into reviewable
  structured drafts.

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

## Quick Start

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

Default CMS:

```text
http://localhost:5173
```

## Publishing Manga Content

The most reliable path today is to add content files manually or through the
current CMS publish flow.

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

## Core Concepts

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
Purchases, promo codes, contributor rewards, admin grants, and subscriptions can
all grant the same kind of read access.

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

- [Architecture](ARCHITECTURE.md)
- [Comic domain specification](comic-domain-spec.md)
- [Entitlement specification](entitlement-spec.md)
- [Ingestion specification](ingestion-spec.md)
- [Content guide](docs/CONTENT_GUIDE.md)
- [Public release checklist](docs/PUBLIC_RELEASE_CHECKLIST.md)
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

## License

Apache-2.0. See [LICENSE](LICENSE).

⸻

License

MIT License.

⸻

Vision

The long-term goal is to create an open publishing layer for comics.

A system where:
	•	creators control their content
	•	readers can interact with stories
	•	communities can build translation and commentary layers

Comics should not be static images.

They should be living narrative systems.

⸻

If you want to build a manga site, fork this repository and start creating.
