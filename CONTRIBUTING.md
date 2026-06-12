# Contributing

Thanks for helping improve Manga CMS.

This project is early. The best contributions are small, concrete changes that
make the viewer, CMS, ingestion workflow, or content format easier to run and
understand.

## Good First Areas

- Improve setup and documentation.
- Add or fix content validation.
- Improve the creator CMS workflow.
- Add examples for `contents/` and `packs/`.
- Improve viewer behavior for panel highlights, zoom, and deep links.
- Improve manuscript ingestion from images, PSD, text export, or Clip Studio
  workflows.
- Add tests around API contracts and repository loading.

## Development Setup

Requirements:

- Node.js 20 or newer
- pnpm 9.5.0

Fast local demo:

```bash
docker compose up --build
```

The default Compose stack is for local demos only. Do not expose it directly to
the internet without replacing development secrets and following the deployment
docs.

Install:

```bash
pnpm install
pnpm --filter @manga/db db:generate
```

Build:

```bash
pnpm build
```

Before opening a PR, run the narrowest useful checks:

```bash
pnpm lint
pnpm validate:content
```

For focused package work, run the matching package tests when they exist:

```bash
pnpm --filter @manga/cms test
pnpm --filter @manga/ingestion test
pnpm --filter @manga/schemas test
```

Run API:

```bash
cd apps/api
pnpm dev
```

Run viewer:

```bash
cd apps/viewer
API_BASE=http://localhost:3000/api/v1 pnpm dev
```

Run CMS:

```bash
cd apps/cms
pnpm dev
```

## Pull Request Guidelines

- Keep PRs focused.
- Prefer existing package boundaries over new abstractions.
- Update docs when changing setup, content format, API behavior, or launch
  assumptions.
- Preserve the canonical hierarchy: `Series -> Episode -> Page -> Panel -> Bubble`.
- Keep `contents/` and `packs/` as the canonical manga content source unless an
  explicit migration task says otherwise.
- Treat the runtime database as operational state, not the canonical manga
  content store.
- Add tests when changing shared domain logic, schemas, ingestion, entitlement,
  delivery, or API contracts.
- Do not commit real secrets, private manuscripts, production databases, or
  unpublished third-party content.
- Do not add payment-provider, hosted SaaS, custom-domain routing, or
  provider-specific CDN/object-storage implementations to the public OSS repo.

## Content Contributions

Only submit manga content that you have the right to publish under a compatible
license or explicit permission. If content is only for local testing, keep it out
of the repository.

For content format details, see [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md).

## Security

Please do not open a public issue for secrets, auth bypasses, entitlement bypasses,
or delivery-token vulnerabilities. Follow [SECURITY.md](SECURITY.md).

## License

By contributing to this repository, you agree that your contribution is licensed
under the Apache License 2.0.
