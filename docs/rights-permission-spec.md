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

Minimum product roles:

- owner
- editor
- translator
- reviewer
- contributor
- moderator
- viewer

Expanded roles:

- original_rights_holder
- translation_reviewer
- footnote_contributor
- pack_maintainer
- publisher

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

## Audit Requirements

Track:

- who proposed
- who reviewed
- who approved
- who published
- when status changed
- target series/episode/page/panel/bubble/region
- affected pack and version
