# Reader Policy Spec

This document defines the API-side contract for Reader interaction policy. It
is the source for CMS policy editing and Viewer effective-policy reads.

This is a contract and persistence design only. It does not add a DB migration,
Viewer UI, CMS UI, SNS posting, or dynamic OGP generation.

## Goals

- Let Viewer read one effective policy for a Series or Episode.
- Let CMS edit scoped policy overrides without mutating canonical content.
- Keep policy inheritance explicit across default, Series, and Episode scopes.
- Keep target-level `flags.shareable` and `flags.feedback_enabled` meaningful.
- Keep publication `visibility` and entity `status` ahead of interaction
  policy so hidden or deleted content does not leak through share surfaces.

## Target Vocabulary

| Target | Stable identifier | Share | Report | OGP |
| --- | --- | --- | --- | --- |
| `page` | `pageId` | Default allowed target. | Default report target. | Supported by `/og/page/{pageId}`. |
| `panel` | `panelId` | Optional when policy allows. | Optional when policy allows. | Future facade. |
| `bubble` | `bubbleId` | Optional quote/share target. | Optional when policy allows. | Future facade. |
| `region` | Page-local point or bbox | Not shareable by default. | Draft fallback only. | Not public by default. |
| `clip` | Series/Episode/Page plus Panel range | Optional share target. | Reports resolve to Page/Panel/Bubble. | Future facade. |

Region is review metadata. Current Reader can encode a Region as a Page target
plus `region` query data in `source_url`; a first-class Region feedback payload
requires a later schema/OpenAPI task.

## Policy Shape

```ts
type ReaderPolicyScopeType = "default" | "series" | "episode";
type ShareTargetKind = "page" | "panel" | "bubble" | "clip";
type ReportTargetKind = "page" | "panel" | "bubble" | "region";
type OGPTargetKind = "page" | "panel" | "bubble" | "clip";
type SNSShareService = "native" | "copy_url" | "x" | "line" | "bluesky";
type ReaderFeedbackDisplayPolicy =
  | "hidden"
  | "editors_only"
  | "approval_required"
  | "public";

interface ReaderFeatureFlags {
  exploreMode: boolean;
  targetSelection: boolean;
  feedback: boolean;
  quote: boolean;
  clip: boolean;
  reaction: boolean;
  packs: boolean;
  purchase: boolean;
  redeem: boolean;
  snsShare: boolean;
  ogp: boolean;
}

interface ReaderInteractionPolicy {
  shareTargets: ShareTargetKind[];
  reportTargets: ReportTargetKind[];
  ogpTargets: OGPTargetKind[];
  snsShareServices: SNSShareService[];
  feedbackDisplay: ReaderFeedbackDisplayPolicy;
  simpleViewerMode: boolean;
  features: ReaderFeatureFlags;
}

type ReaderInteractionPolicyOverride = Partial<{
  shareTargets: ShareTargetKind[];
  reportTargets: ReportTargetKind[];
  ogpTargets: OGPTargetKind[];
  snsShareServices: SNSShareService[];
  feedbackDisplay: ReaderFeedbackDisplayPolicy;
  simpleViewerMode: boolean;
  features: Partial<ReaderFeatureFlags>;
}>;
```

`ReaderInteractionPolicy` is the fully resolved public shape. CMS stores
`ReaderInteractionPolicyOverride` records so missing fields inherit from the
parent scope.

Recommended default policy:

```ts
const defaultReaderPolicy: ReaderInteractionPolicy = {
  shareTargets: ["page"],
  reportTargets: ["page", "panel", "bubble"],
  ogpTargets: ["page"],
  snsShareServices: ["native", "copy_url"],
  feedbackDisplay: "editors_only",
  simpleViewerMode: false,
  features: {
    exploreMode: true,
    targetSelection: true,
    feedback: true,
    quote: true,
    clip: true,
    reaction: true,
    packs: true,
    purchase: true,
    redeem: true,
    snsShare: true,
    ogp: true,
  },
};
```

When `simpleViewerMode` is true, the resolver should start from a reading-only
preset and then apply explicit overrides:

```ts
const simpleViewerPreset: Partial<ReaderInteractionPolicy> = {
  shareTargets: ["page"],
  reportTargets: [],
  ogpTargets: ["page"],
  snsShareServices: ["native", "copy_url"],
  feedbackDisplay: "hidden",
  features: {
    exploreMode: false,
    targetSelection: false,
    feedback: false,
    quote: false,
    clip: false,
    reaction: false,
    packs: false,
    purchase: false,
    redeem: false,
    snsShare: true,
    ogp: true,
  },
};
```

## Scope And Inheritance

Scopes:

| Scope | Meaning | Scope id |
| --- | --- | --- |
| `default` | Site/runtime default policy | `default` |
| `series` | Series-level override | `seriesId` |
| `episode` | Episode-level override | `{seriesId}:{episodeId}` |

Effective policy resolution order:

```text
system default
  -> default policy override
  -> Series override
  -> Episode override
  -> target ContentFlags / status / visibility gates
```

Rules:

- Missing fields inherit from the previous scope.
- Array fields replace the inherited array when present. An empty array means
  the feature is intentionally disabled for that target/service class.
- `features` merges by key. Missing keys inherit.
- Episode override cannot make a hidden, archived, scheduled, expired, or
  entitlement-restricted item public.
- Target-level `flags.shareable === false` prevents sharing even if the policy
  includes that target kind.
- Target-level `flags.feedback_enabled === false` prevents report/proposal UI
  even if the policy includes that target kind.
- Missing `flags` are treated as allowed for backward compatibility.
- Entity `status: "deleted"` or `"merged"` makes the target unavailable for new
  share/report/OGP actions.
- Entity `status: "deprecated"` remains readable for old links but should not
  be offered as a new share/report target unless a future policy field permits
  deprecated targets explicitly.

Publication `visibility`, schedule, and entitlement checks happen before reader
policy. Policy can only reduce surfaces for content that is already public and
available to the current request.

## Public Effective Policy API

Viewer reads effective policy only.

```http
GET /api/v1/series/{seriesId}/reader-policy
GET /api/v1/series/{seriesId}/episodes/{episodeId}/reader-policy
```

Response:

```ts
interface PublicReaderPolicyResponse {
  scope: {
    type: "series" | "episode";
    series_id: string;
    episode_id?: string;
  };
  policy: ReaderInteractionPolicy;
  inherited_from: {
    default: boolean;
    series: boolean;
    episode: boolean;
  };
  updated_at?: string;
}
```

Public responses may include:

- `shareTargets`
- `reportTargets`
- `ogpTargets`
- `snsShareServices`
- `feedbackDisplay`
- `simpleViewerMode`
- `features`
- `inherited_from`
- `updated_at`

Public responses must not include:

- editor notes
- draft-only unpublished overrides
- `updated_by`
- admin audit history
- private feedback counts
- moderation queues
- identity or rights records

If no stored policy exists, the API returns the resolved default effective
policy. If the Series or Episode is not public for the current request, the
endpoint follows the same visibility behavior as the Series/Episode reader
endpoint and returns 404.

## Admin Draft Policy API

CMS edits stored override records.

```http
GET /api/v1/admin/reader-policies
PUT /api/v1/admin/reader-policies/{scopeType}/{scopeId}
```

Query parameters for `GET /admin/reader-policies`:

- `scope_type`: optional `default`, `series`, or `episode`
- `series_id`: optional filter
- `episode_id`: optional filter
- `include_effective`: optional boolean. When true, include resolved effective
  policy next to the stored override.

Request body for `PUT /admin/reader-policies/{scopeType}/{scopeId}`:

```ts
interface UpsertReaderPolicyRequest {
  policy: ReaderInteractionPolicyOverride;
  note?: string;
}
```

Response:

```ts
interface ReaderPolicyRecord {
  policy_id: string;
  scope_type: ReaderPolicyScopeType;
  scope_id: string;
  series_id?: string;
  episode_id?: string;
  policy: ReaderInteractionPolicyOverride;
  effective_policy?: ReaderInteractionPolicy;
  note?: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}
```

`scopeId` path encoding:

- `default/default`
- `series/{seriesId}`
- `episode/{seriesId}:{episodeId}`

The API should validate that `seriesId` and `episodeId` exist before storing an
override. Passing an empty array is a deliberate disable. Omitting a field means
inherit.

## Persistence Design

File-backed MVP:

- Store policy records under `READER_POLICY_DIR`, defaulting to
  `reader-policies/reader-policies.jsonl`.
- Use a local file lock around read/modify/write operations.
- Store override records only; compute effective policy on read.
- Treat file-backed storage as single-host development/staging support.

DB-backed migration boundary:

- Move records into `packages/db` runtime state when multi-instance CMS editing
  or production policy audit is needed.
- Use a unique key on `(scope_type, scope_id)`.
- Keep policy records separate from canonical `contents/` Series/Episode/Page
  data.
- Preserve the public effective-policy response shape during migration.

Canonical content migration is not required for this contract. Existing
`flags.shareable`, `flags.feedback_enabled`, `visibility`, and `status` remain
part of content. Reader policy is runtime configuration layered on top.

## OGP And SNS Boundaries

`snsShareServices` only controls Viewer URL/share-sheet availability:

- `native`: Web Share API
- `copy_url`: copy URL
- `x`: X intent URL
- `line`: LINE share URL
- `bluesky`: Bluesky compose URL

The API and Viewer must not post to SNS platforms.

`ogpTargets` controls stable API facades only. Current implementation supports
`page` through `/og/page/{pageId}`. Future design-level facades are:

- `GET /api/v1/og/panel/{panelId}`
- `GET /api/v1/og/bubble/{bubbleId}`
- `GET /api/v1/og/clip/{seriesId}/{episodeId}/{pageNumber}/{panelStart}/{panelEnd}`

All OGP facades must enforce public visibility, entitlement/gating, share
policy, OGP policy, and delivery containment. They must not expose raw
filesystem paths. Heavy dynamic image composition remains out of scope until a
later implementation task.

### Share And OGP Policy Gates

The current effective policy arrays are the public contract for target
availability:

- Episode Share URL availability is allowed when the Episode is public and
  `features.snsShare` is true.
- Page sharing is allowed when `shareTargets` includes `page`.
- Panel sharing is allowed when `shareTargets` includes `panel`.
- Bubble/quote sharing is allowed when `shareTargets` includes `bubble`.
- Page OGP is allowed when `ogpTargets` includes `page`.
- Panel OGP crop is allowed only when both `shareTargets` and `ogpTargets`
  include `panel`.
- Bubble/quote OGP is allowed only when both arrays include `bubble`.

Future CMS labels may expose these booleans, but they should map to the
effective policy rather than create a parallel source of truth:

```text
allowEpisodeShare -> public Episode + features.snsShare
allowPageShare    -> shareTargets includes page
allowPanelShare   -> shareTargets includes panel
allowBubbleShare  -> shareTargets includes bubble
allowOgpCrop      -> ogpTargets includes panel or bubble, scoped by target
ogpStyle          -> future style preset for generated artifacts
```

`ogpStyle` is design-level only for now. The default style should generate a
1200px-class PNG preview with contain-fit crop, deterministic padding, and
alt text derived from Series/Episode/Page/Panel context. Style changes must
produce a new revisioned OGP image URL or content hash; they must not mutate
bytes behind an existing URL.

Policy inheritance remains default -> Series -> Episode, with target-level
content flags and public visibility applied last. A future target-specific
override can narrow a single Page/Panel/Bubble, but it must not make non-public
or rights-uncleared content shareable.

## Unimplemented In This Phase

- API route implementation.
- OpenAPI executable endpoint additions.
- Domain/Zod schema additions.
- DB migration.
- Viewer or CMS UI changes.
- Region feedback payload.
- Real SNS posting.
- Heavy OGP image generation.
