# Architecture Layer Boundary

Last updated: 2026-06-07

Manga CMS is organized into three layers. Keeping the layers separate prevents
public OSS work from accidentally depending on private commercial operations.

## Layer 1: Open Manga Content Format

Purpose: define portable structured manga content.

Includes:

- `contents/`
- `packs/`
- `Series -> Episode -> Page -> Panel -> Bubble` contracts
- Pack contracts
- schema validation
- content loading and writing rules
- generic metadata, text layout, translation, feedback, and share policy
  contracts
- generic published artifact and manifest concepts

Source of truth:

- `contents/` is canonical for manga content.
- `packs/` is canonical for Pack manifests.
- Image assets referenced by canonical content are part of the content backup
  and restore boundary.
- Generated manifests, search indexes, runtime DB rows, CDN objects, and viewer
  payloads are derived artifacts unless an explicit content-store migration says
  otherwise.

## Layer 2: OSS Self-hosted Publishing Engine

Purpose: make the open format usable as a self-hosted manga site.

Includes:

- `apps/viewer` Astro public Reader
- `apps/cms` creator/editor CMS
- `apps/api` Hono API server
- `packages/domain`, `packages/schemas`, `packages/db`, and
  `packages/ingestion`
- local filesystem-backed publishing
- basic auth, API keys, session, entitlement, and audit primitives
- feedback/proposal workflows
- generic import/export and validation tooling
- backup/restore and production operations docs for self-hosting

Runtime DB boundary:

- The runtime DB stores operational state.
- It does not become the canonical manga content store.
- Backup/restore must distinguish runtime DB backup from content backup.
- The runtime DB may store derived indexes, caches, references, and operational
  records, but those rows do not replace canonical `contents/` and `packs/`.
- Basic entitlement primitives belong here when they are provider-neutral access
  control. Payment provider fulfillment, refunds, disputes, purchase recovery,
  reconciliation, payouts, and revenue sharing belong to Layer 3.

Provider boundary:

- The self-hosted engine may describe provider-neutral storage and manifest
  interfaces.
- It should not require a specific commercial CDN, object store, hosted tenant
  platform, or payment provider to run.

## Layer 3: Private Commercial Platform

Purpose: hosted/commercial Manga CMS operations outside the OSS deliverable.

Examples:

- hosted creator registration
- tenant administration
- paid checkout and webhook fulfillment
- refund/dispute automation and reconciliation
- commercial purchase recovery
- revenue sharing and payout operations
- custom domains and hosted routing
- Cloudflare for SaaS automation
- production object-storage/CDN adapters for a commercial deployment
- forensic fingerprinting, watermarking, leak detection, and abuse operations

Public repository rule:

- Keep private platform implementation out of the public repo.
- Only generic interfaces or high-level boundaries should be public.
- Do not publish secrets, private URLs, unreleased business plans, or detailed
  protection algorithms.

## Layer Interaction Rules

1. Layer 1 must remain usable without Layer 3.
2. Layer 2 may depend on Layer 1 and may provide generic extension points.
3. Layer 3 may adapt Layer 1 and Layer 2 privately, but Layer 1 and Layer 2 must
   not require Layer 3.
4. Public roadmap items should name Layer 3 only as future/private work.
5. Commercial implementation notes should not be mixed into the public roadmap.
