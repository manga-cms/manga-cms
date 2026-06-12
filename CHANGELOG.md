# Changelog

All notable public changes to Manga CMS will be documented here.

This project is still pre-1.0. Until the first tagged release, `main` may move
quickly, but public contracts should still be changed deliberately and noted in
pull requests.

## Unreleased

### Added

- Public self-hosted engine documentation, Docker Compose local demo path, and
  split GitHub Actions CI.
- Structured content model for `Series -> Episode -> Page -> Panel -> Bubble`.
- Viewer, CMS, API, ingestion proof-of-concept, content validation, Pack
  validation, and API round-trip smoke coverage.

### Changed

- Keep `contents/` and `packs/` as the canonical editorial source of truth.
- Keep runtime DB state separate from canonical manga content.

### Notes

- The first public sample content package is pending creator-approved rights
  text and assets.
- Commercial hosted platform features remain outside the public OSS deliverable.

## Release Policy

- Use `v0.x.y` tags while the project is pre-1.0.
- Patch releases should be compatible bug fixes, docs corrections, or small
  operational improvements.
- Minor releases may add public features, content validation behavior, or
  provider-neutral contracts.
- Any change to the canonical content shape, API behavior, Pack format, delivery
  token semantics, or public URL/indexing behavior must be called out in this
  changelog.
- `schemaVersion` should only change when old content can no longer be parsed
  or when the meaning of an existing canonical field changes.
