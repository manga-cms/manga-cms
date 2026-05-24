# @manga/ingestion

Isolated ingestion PoC package for the manga CMS monorepo.

This package is intentionally separate from the production API, viewer, and CMS.
It models the ingestion pipeline described in the architecture docs without wiring
it into runtime services yet.

## Layer separation

The PoC keeps three layers separate.

### 1. Artifact layer

Artifact data is raw or intermediate output from OCR, vision models, alignment,
or draft-building steps.

Artifact data may contain:

- model/provider metadata
- confidence scores
- diagnostics and warnings
- source provenance
- candidate bounding boxes

Artifact data is not canonical content and must never be written into `contents/`.

### 2. Canonical draft layer

The canonical draft layer is the confirmable content candidate.

In this repository, that means compatibility with
`@manga/domain` `DraftPayload` and related ingestion draft types.

This is the layer that a CMS review UI should confirm or edit before publish.
It does not carry AI-specific metadata.

### 3. Canonical content layer

Canonical content is the final source of truth stored in `contents/`.

This package does not write to `contents/` and does not model production publish
integration. It only produces confirmable draft candidates and separate artifacts.

## Job-based pipeline

The PoC follows the repository ingestion design:

1. normalize page inputs
2. detect regions
3. align OCR and source text
4. build artifact-backed draft candidate
5. emit canonical draft for review

The pipeline is job-oriented rather than synchronous API-oriented. A single job
can process one episode or a small page set and return:

- artifact bundles per page
- a canonical draft payload
- review/cost metrics

## Provider abstraction

LLM integration is abstracted behind `IngestionLLMProvider`.

This keeps the PoC from hard-coding Gemini as the only path and makes it safe to
compare providers later.

The expected provider responsibilities are:

- detect region candidates
- align OCR/source text against candidates
- build reviewable draft candidates

The initial PoC package includes interfaces and a `NoopIngestionProvider` stub,
not a production provider integration.

## Package layout

```text
src/
  artifacts/   artifact stores and bundle helpers
  drafts/      canonical draft builders and helpers
  metrics/     PoC evaluation metrics
  pipeline/    job-based orchestration
  providers/   provider abstraction and stubs
  schemas/     TypeScript JSON-schema-like descriptors
  types/       core PoC types
  utils/       ids, confidence, and utility helpers
```

## Non-goals

- no API integration
- no CMS integration
- no viewer integration
- no production queue/worker integration
- no writes to `contents/`

Those pieces belong in later integration phases after the PoC proves that review
time can be reduced.
