# Translation Governance Spec

Translation is not a single permission. Proposal, review, adoption, publication, image generation, and commercial use are separate stages.

This is a product and engineering design document, not legal advice. Production use requires legal review for contributor terms, translator agreements, and rights grants.

## Core Distinctions

### Translation Proposal

A reader or contributor suggests a translation improvement.

- Does not grant the proposer translation publication rights.
- Does not change canonical content.
- Requires contributor terms before submission can be used in packs.

### Official Translation

A translation accepted by rights holders or delegated reviewers and included in an approved/published Translation Pack.

### Translation License / Grant

Permission from rights holder or authorized manager to create, publish, distribute, or commercially use translations.

## Translation Stages

1. Propose translation
2. Review translation proposal
3. Adopt into Translation Pack
4. Publish Translation Pack
5. Generate/render translated page images
6. Distribute or commercially use translated work

These must be separate permissions.

## Proposal Terms

Before accepting reader translation or footnote proposals, the product should require contributor terms covering at least:

- contributor has the right to submit the content
- submission does not infringe third-party rights
- accepted submissions may be used in Translation Packs, Footnote Packs, and related display/export flows
- accepted submissions may be edited
- acceptance is not guaranteed
- credit display is controlled by project policy
- abusive/spam submissions may be removed

## Translator Agreements

Formal translators may have rights in their translation output depending on jurisdiction and agreement structure. Agreements should clarify:

- rights ownership or license
- exclusive/non-exclusive terms
- target language
- target series/episode scope
- distribution media
- modification rights
- credit
- compensation
- reuse
- post-termination handling

## Pack Publication Flow

```text
Proposal
  -> Review
  -> Adopt into draft Pack
  -> Pack review
  -> Rights check
  -> Publish
  -> Reader availability
```

## Pack Classes

| Class | Meaning |
|-------|---------|
| proposal | unreviewed community proposal |
| draft | maintainer draft |
| official | rights-holder-approved translation |
| deprecated | replaced or withdrawn |

## Reader Policy

- Reader can collect proposals.
- Reader can show approved/published packs.
- Reader cannot publish packs.
- Reader cannot imply that a proposal is official.

## CMS Policy

- CMS owns review, approval, merging, pack publication, and rights checks.
- CMS should track reviewer and publisher identity.
- CMS should preserve proposal history for audit.
- Proposal Queue records are runtime review state. `accepted` means accepted
  for follow-up work, not automatically published or merged into a Pack.
- Current Proposal Queue kinds are `translation`, `typo`, `footnote`,
  `commentary`, `tag`, and `structure`.

## Reference Notes

Japanese copyright materials from the Agency for Cultural Affairs discuss translation/adaptation rights and rights around derivative works. Treat this as a reason to keep proposal rights, translator rights, and original rights holder approval separate.

- Agency for Cultural Affairs copyright textbook: https://www.bunka.go.jp/seisaku/chosakuken/textbook/
- Agency for Cultural Affairs copyright manga explanation: https://pf.bunka.go.jp/chosaku/chosakuken/h22_manga/comment/list_na.html
