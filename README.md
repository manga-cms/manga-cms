Manga Infrastructure

Open source infrastructure for publishing manga on the web.

This project provides everything needed to build a manga site:
	•	⚡ Fast manga viewer
	•	🛠 Creator CMS
	•	🌐 Translation system
	•	💬 Quote sharing
	•	🔐 Entitlement / purchase unlock
	•	🧠 Narrative graph structure
	•	📦 Pack-based extensions

The goal is simple:

Anyone should be able to clone this repository and launch a manga website the same day.

⸻

Why this project exists

Most manga sites treat comics as flat images.

But manga actually contains structure:
	•	pages
	•	panels
	•	speech bubbles
	•	quotes
	•	commentary
	•	translations

This project converts manga into structured data so that it becomes programmable media.

Once structured, a manga page can support things like:
	•	quote sharing
	•	multilingual reading
	•	commentary layers
	•	educational annotations
	•	AI navigation
	•	community translations

⸻

Core Ideas

Narrative Graph

A manga is not just images.

It is a graph of narrative units.

Series
  └ Episode
      └ Page
          └ Panel
              └ Bubble

This structure allows the system to support:
	•	quotes
	•	references
	•	commentary
	•	reactions

⸻

Packs

Additional information is stored in packs.

Examples:
	•	translation packs
	•	author commentary
	•	educational notes
	•	community annotations

Packs do not modify the original content.

They extend it.

contents/
packs/


⸻

Quote-based sharing

Instead of sharing entire pages, readers can share quotes.

A quote references a bubble.

Example share URL:

/quote/s01e01p03b04

This allows precise referencing of moments in a story.

⸻

Entitlement

Access control is based on entitlements.

Examples:
	•	purchased episode
	•	redeemed code
	•	subscriber access

This enables flexible publishing models such as:
	•	free chapters
	•	paid chapters
	•	bonus packs
	•	supporter content

⸻

Ingestion Pipeline

Creators upload raw manga files.

The system converts them into structured data.

Pipeline:

Images / PSD / Text export
        ↓
Panel detection
        ↓
Bubble detection
        ↓
OCR assist
        ↓
Matching
        ↓
Draft JSON
        ↓
CMS review
        ↓
Git source of truth

The goal is not full automation.

The goal is reducing manual structuring work.

⸻

Architecture

The project is built as a monorepo.

apps/
  viewer/      → public manga viewer (Astro)
  cms/         → creator CMS (React)
  api/         → API server (Hono)

packages/
  domain/      → shared domain logic
  db/          → database schema
  ingestion/   → isolated ingestion PoC (artifacts + canonical drafts)
  schemas/     → JSON schemas

contents/      → source manga content
packs/         → extensions (translations etc)
scripts/       → ingestion and maintenance


⸻

Technology Stack

Layer	Technology
Viewer	Astro
CMS	React + Vite
API	Hono
DB	Prisma
Storage	R2 / local filesystem
Infra	Cloudflare
Images	AVIF / WebP fallback

This stack was chosen to support both:
	•	Starter mode (local)
	•	Production deployment

⸻

Starter Mode

Starter mode allows running everything locally.

git clone repo
cd project
pnpm install
pnpm dev

This launches:
	•	viewer
	•	cms
	•	api

You can create a manga site immediately.

No cloud services required.

⸻

Production Mode

Production mode is designed for edge deployment.

Recommended stack:
	•	Cloudflare Pages
	•	Cloudflare Workers
	•	R2 storage
	•	Postgres / Neon / Supabase

The architecture remains identical.

⸻

Example Workflow

Create a manga site in minutes.

1. Setup site
2. Create work
3. Create episode
4. Upload pages
5. Review structure
6. Publish

That’s it.

⸻

Project Status

This project is currently in active development.

Planned milestones:
	•	Viewer MVP
	•	CMS MVP
	•	Ingestion pipeline
	•	Pack system
	•	Quote sharing
	•	Entitlement
	•	Translation workflow

⸻

Contributing

Contributions are welcome.

Areas where help is especially valuable:
	•	viewer performance
	•	OCR accuracy
	•	panel detection
	•	CMS UX
	•	translation workflow
	•	accessibility

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
