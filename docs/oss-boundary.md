# OSS Boundary

Last updated: 2026-06-07

This document defines what belongs in the public Manga CMS repository and what
must remain outside it.

## Public Repository Scope

The public repository is a self-hosted manga publishing engine. It may include:

- Open manga content contracts: `Series -> Episode -> Page -> Panel -> Bubble`.
- Canonical content and Pack examples that are explicitly licensed for public
  use.
- `contents/` and `packs/` filesystem conventions.
- Runtime validation schemas and domain types.
- API, Viewer, CMS, ingestion, feedback, proposal, and Pack tooling that can be
  self-hosted.
- Generic import/export, backup/restore, manifest, and published artifact
  concepts.
- Provider-neutral interfaces and documentation.
- Public beta operations checklists that do not expose private infrastructure
  details.

## Must Stay Private

The following do not belong in the public repository unless they are reduced to
provider-neutral, OSS-safe abstractions:

- Hosted creator registration and tenant operations.
- Paid checkout implementation, payment provider secrets, webhook operations,
  purchase recovery, reconciliation, payout operations, and revenue sharing.
- Custom-domain SaaS routing and hosted tenant automation.
- Cloudflare for SaaS implementation.
- Production object-storage/CDN adapters tied to a private commercial
  deployment.
- Detailed fingerprinting, watermarking, leak detection, or forensic workflows.
- Private business plans, private URLs, internal launch notes, unreleased
  commercial details, credentials, tokens, and secrets.

## Source Of Truth Boundary

`contents/` and `packs/` are the canonical editorial source of truth for manga
content in this repository.

Postgres or any other runtime database is not the canonical manga content store.
Runtime DB state is for:

- users and sessions
- API keys
- basic entitlement primitives
- magic-link tokens
- ingestion job state
- feedback/proposal runtime state when file-backed storage is replaced
- audit records
- other operational state

Basic entitlement primitives may remain in the OSS self-hosted engine because
they are useful for generic access control. Stripe integration, paid checkout
fulfillment, refund/dispute automation, purchase recovery, reconciliation,
payouts, and revenue sharing remain private/commercial-layer work.

If manga content is ever moved out of `contents/` and `packs/`, that must be an
explicit migration that updates the API contract, domain interfaces, schemas,
CMS workflow, import/export tools, and backup policy together.

## Published Artifacts Boundary

Generic manifest and published artifact concepts are OSS-safe. For example, the
public repository may define that a publish step emits immutable page images,
core JSON, Pack JSON, OGP images, and a manifest that points to those artifacts.

Provider-neutral interfaces and manifest/export contracts are OSS-safe.
Vendor-specific production deployment code is a separate layer. Cloudflare R2
adapters, cache rules, custom hostname routing, commercial CDN adapters, paid
gated delivery, and commercial deployment automation should not be added to the
public repository as part of generic roadmap or format work.

## Documentation Rules

Public documentation should use neutral language and describe self-hosted
operation. It should not imply that the hosted commercial platform is part of
the OSS deliverable.

When documenting future commercial work, keep it high level and explicitly mark
it as private or future. Do not include implementation recipes for private
business operations or content-protection systems.
