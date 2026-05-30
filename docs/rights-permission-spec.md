# Rights And Permission Spec

Rights control must be separate from reading entitlements.

Reading entitlement answers: can this user read this content?
Production permission answers: can this user propose, edit, review, publish, or commercially use this layer?

## Contract Sources

- `packages/domain/src/rights-types.ts`
- `packages/schemas/src/rights.ts`
- `openapi.yaml` `Rights*` component schemas

No Rights admin API routes are implemented yet. The current phase fixes the
shared vocabulary and validation shape before CMS UI or persistence work starts.

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
