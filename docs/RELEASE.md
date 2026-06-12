# Release Process

Manga CMS is currently pre-1.0. Public releases should be lightweight, but they
must keep content contracts, public URLs, and self-hosting expectations clear.

## Versioning

- Use `v0.x.y` tags before 1.0.
- Use patch releases for compatible fixes, documentation updates, and small
  operational improvements.
- Use minor releases for new public features, provider-neutral contracts,
  content validation behavior, or self-hosting workflow changes.
- Do not use a tag to imply that commercial hosted platform features are part of
  the public OSS deliverable.

## Before Tagging

Run or confirm:

```bash
pnpm lint
pnpm test:compose-safety
pnpm validate:content
pnpm test:content-validation
pnpm check:docs
pnpm build
```

For release candidates that touch API/content contracts or ingestion behavior,
also run the most relevant package tests:

```bash
pnpm --filter @manga/cms test
pnpm --filter @manga/ingestion test
pnpm --filter @manga/schemas test
```

For release candidates that touch API persistence or delivery behavior, confirm
the GitHub Actions `api-roundtrip-smoke` job is green.

## Changelog

Move relevant items from `Unreleased` in [../CHANGELOG.md](../CHANGELOG.md) into
a dated release section before tagging.

Call out changes to:

- canonical content shape or `schemaVersion`;
- API behavior or route compatibility;
- Pack format or Pack validation;
- public Reader URLs, Share URLs, OGP, robots, sitemap, or indexing behavior;
- delivery token, auth token, or entitlement semantics;
- self-hosting setup requirements.

## Tagging

Use annotated tags:

```bash
git tag -a v0.x.y -m "v0.x.y"
git push origin v0.x.y
```

## Boundary Check

Before tagging, confirm the release does not include:

- secrets, private manuscripts, production databases, or private user data;
- private business plans, unreleased commercial operations, or private URLs;
- payment-provider implementations, hosted SaaS operations, custom-domain
  routing, revenue-sharing, commercial CDN adapters, or private content
  protection workflows;
- unlicensed manga content under `contents/`, `packs/`, or public assets.

Tracked sample manga content must follow
[SAMPLE-CONTENT-CHECKLIST.md](SAMPLE-CONTENT-CHECKLIST.md).
