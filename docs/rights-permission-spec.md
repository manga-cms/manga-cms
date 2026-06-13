# Rights And Permission Spec

Rights control must be separate from reading entitlements.

Reading entitlement answers: can this user read this content?
Production permission answers: can this user propose, edit, review, publish, or commercially use this layer?

## Contract Sources

- `packages/domain/src/rights-types.ts`
- `packages/domain/src/rights-repository.ts`
- `packages/schemas/src/rights.ts`
- `openapi.yaml` `Rights*` component schemas

The MVP Rights admin API is intentionally small:

- `GET /api/v1/admin/rights/grants`
- `POST /api/v1/admin/rights/grants`
- `POST /api/v1/admin/rights/grants/{grantId}/revoke`
- `POST /api/v1/admin/rights/check`

These routes manage runtime governance grants only. They do not grant reader
entitlement, publish Packs, or mutate canonical content.

## Roles

Global admin is not a Series grant role. It is an operational auth role
resolved from the current session/API key and is used for bootstrap and
cross-Series administration. In the production magic-link MVP, global admins
come from `CMS_ADMIN_EMAILS`; this is a bootstrap allowlist, not the long-term
rights model.

Minimum product roles:

- global_admin
- owner
- editor
- translator
- reviewer

Expanded roles:

- contributor
- moderator
- viewer
- original_rights_holder
- translation_reviewer
- footnote_contributor
- pack_maintainer
- publisher

Series grant roles:

- owner
- editor
- translator
- reviewer

Roles are labels for UX and audit. Enforcement should check explicit
permissions, not infer capability from the role string alone.

## Permissions

Initial permission set:

- propose_translation
- propose_footnote
- edit_structure
- edit_translation
- review_translation
- review_footnote
- approve_translation
- approve_footnote
- publish_pack
- manage_rights
- moderate_proposals
- commercial_use

## Scope

Permissions should be scoped by:

- series
- episode
- language
- pack
- usage

Example:

```yaml
role: translator
series: storyboard-ui-check
language: en
permissions:
  - edit_translation
  - submit_for_review
```

## Runtime Storage

Series permissions are runtime state. They belong in `packages/db`, not in
canonical `contents/`, and must not move Series/Episode/Page/Panel/Bubble
source data into the DB.

Current storage policy:

- With `DATABASE_URL`, Rights grants are stored in the Prisma `RightsGrant`
  model.
- Without `DATABASE_URL`, local development uses file-backed
  `RIGHTS_DIR/rights-grants.json`.
- Both implementations use the same provider-neutral contract:
  `subject_user_id`, `role`, `permissions[]`, and `scope`.
- Revocation records `revoked_at` and `revoked_by` together. `revoked_by` is
  the authenticated operator's stable user ID and must not be a provider-local
  email, GitHub login, or payment customer ID.
- `scope.series_id` is the MVP boundary for CMS Series administration. Narrower
  `episode_id`, language, Pack, usage, and territory scopes are already part of
  the contract for future workflows.

Provider-specific identity data, such as email or GitHub login, may be used to
authenticate or verify a person, but permission grants should target only the
resolved `subject_user_id`.

## Minimal CMS Enforcement

The minimum implementation is:

- global admin can manage all Series and bootstrap grants.
- a user with an active Series grant can operate only on that Series.
- users without a global admin role or matching Series grant receive 401/403 on
  admin operations.
- Series content writes require `edit_structure` or `manage_rights`.
- Series admin reads can use any active Series admin permission, including
  translation/review permissions, so the CMS can open only assigned Series.
- Rights grant delegation requires `manage_rights` and must remain bounded to
  the delegator's own `scope.series_id`.
- Pack draft, feedback, proposal, ingestion, GitHub handoff, entitlement, and
  identity admin surfaces remain global-admin-only for now. This is remaining
  Series-scoped user feature coverage, not a known security hole; CMS should
  not expose those tools to Series-scoped users until each surface has explicit
  Series-scope enforcement.
- The current per-Series filtering may perform one grant check per Series. That
  is acceptable for MVP; optimize later by loading the user's active grants once
  and evaluating manageable Series from that grant set.

Suggested role-to-permission defaults:

- global_admin: all Series permissions, all Series scopes, operational only.
- owner: `edit_structure`, `edit_translation`, `review_translation`,
  `review_footnote`, `approve_translation`, `approve_footnote`, `publish_pack`,
  `manage_rights`, `moderate_proposals`.
- editor: `edit_structure`, `edit_translation`, `review_translation`,
  `review_footnote`, `approve_translation`, `approve_footnote`, `publish_pack`,
  `moderate_proposals`.
- translator: `edit_translation` scoped to a Series and optionally language.
- reviewer: `review_translation`, `review_footnote`, `approve_translation`,
  `approve_footnote` scoped to a Series and optionally language.

## Future Hierarchical Scope Model

The long-term model should support hierarchical production rights without
making the MVP UI complex. Use the canonical content hierarchy and keep
creator/author ownership as a higher-level scope:

```text
creator
  -> series
    -> episode
      -> page
        -> panel / bubble
```

The first UI should expose only the practical subset: creator or team later,
then Series, Episode, language, Pack, and usage. The internal model should stay
compatible with narrower future scopes such as Page, Panel, Bubble, region, or
specific Pack entry when editorial operations need them.

Recommended future scope shape:

```ts
type RightsScope = {
  creator_id?: string;
  series_id?: string;
  episode_id?: string;
  page_id?: string;
  panel_id?: string;
  bubble_id?: string;
  team_id?: string;
  language?: string;
  pack_type?: "TRANSLATION" | "FOOTNOTE" | "COMMENTARY" | "LEARNING" | "ACCESSIBILITY";
  pack_id?: string;
  usage?: RightsUsage[];
  territory?: string;
};
```

Resolution rules should be simple:

- More specific grants can narrow a broad grant, but MVP should start with
  allow-only grants.
- Avoid explicit deny rules until there is a strong operational need; deny
  precedence makes reviewer and admin UX harder to explain.
- A user with Series-level rights must not automatically receive creator-level
  rights.
- A user with translation rights for one language must not receive rights for
  all languages.
- A user with Pack rights must not receive original-content rights.
- Delegated `manage_rights` should be bounded by the delegator's own scope.
  For example, a Series manager cannot grant creator-wide rights.

Teams/groups should be added before complex per-user grants become hard to
operate. A grant can target either a user or a team such as
`translation-team-en`, but the permission check should still resolve to the
same `RightsPermission` set.

## Translation Grant Model

Conceptual model for later implementation:

```yaml
translation_grant:
  work_scope: series | episode | volume
  language: en
  scope: proposal | official_pack | commercial_distribution
  territory: worldwide
  starts_at: 2026-05-29
  ends_at: null
  usage:
    - free_view
    - paid_view
    - promotional
  can_sublicense: false
```

## MVP Permission Defaults

Initial MVP can stay simple:

- anyone authenticated: propose_translation, propose_footnote
- translator: edit_translation for assigned language
- reviewer/editor: approve_translation, approve_footnote
- owner/editor: publish_pack
- owner: manage_rights

## Hard Rules

- Translation proposal is not translation publication right.
- Pack publication requires owner/editor permission.
- Commercial use requires explicit grant.
- Language-specific grants must not imply all-language grants.
- Pack-specific grants must not imply original-content rights.
- Hosted tenant onboarding, creator self-registration, paid checkout, payouts,
  revenue share, and custom-domain SaaS routing are private/commercial product
  surfaces and are out of scope for the OSS permission core.
- The OSS core may expose provider-neutral runtime rights primitives, but
  provider-specific customer, billing, payout, and tenant automation must stay
  outside this contract until explicitly designed.

## Audit Requirements

Track:

- who proposed
- who reviewed
- who approved
- who published
- who revoked a grant
- when status changed
- target series/episode/page/panel/bubble/region
- affected pack and version
