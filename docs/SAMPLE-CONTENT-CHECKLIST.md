# Sample Content Checklist

This checklist is for adding public sample manga content to the repository.
Sample content is not covered by the Apache-2.0 code license unless its own
license says so.

Use this checklist before committing anything under `contents/`, `packs/`, or
public sample asset directories.

Even when the creator made the sample specifically for Manga CMS, include a
sample-specific `LICENSE.md` or `RIGHTS.md`. Self-authored content still needs
explicit public repository, demo, translation, screenshot, OGP, and
redistribution terms.

## Intended First Sample License Shape

For the first curated sample, the intended terms are:

- The creator keeps copyright. Copyright is not transferred to Manga CMS.
- The creator explicitly permits GitHub repository inclusion.
- The creator explicitly permits public web demo publication.
- Translation is allowed.
- Free redistribution as part of this repository is allowed.
- Selling the manga content itself is prohibited.
- The code license and the sample content license remain separate.

Do not describe this as a generic open-content license unless a named license is
chosen and reviewed. If no standard license fits, include a short custom
`LICENSE.md` or `RIGHTS.md` inside the sample content directory.

## Required Files Per Sample

Each tracked sample should include:

- `LICENSE.md` or `RIGHTS.md` describing the sample-specific content terms.
- Attribution text with creator display name.
- Takedown or contact process for maintainers.
- A note that the repository code remains Apache-2.0, while the manga content
  uses its own terms.
- A confirmation of whether translations, text exports, screenshots, and OGP
  preview images are allowed.

Recommended layout:

```text
contents/
  sample-series/
    RIGHTS.md
    series.json
    ep01/
      episode.json
      pages/
        p01.webp
        p02.webp
```

If translation Packs are included:

```text
packs/
  sample-series-en/
    RIGHTS.md
    pack.json
```

## Feature Coverage Recommendations

These are recommended, not mandatory. They help a single public sample double
as a demo, documentation corpus, and regression target.

- [ ] Include at least one page-level caption or SFX Bubble with
      `panelId: null`.
- [ ] Include both vertical and horizontal Bubbles.
- [ ] Include at least one line with ruby/furigana needs, so future text layer
      and ruby notation work has a realistic case to test.
- [ ] Include a page with a bleed panel or intentional bbox overflow, so bbox
      warnings can be demonstrated without blocking save.
- [ ] Include both very short and longer dialogue, so translation fit guidance
      has visible examples.
- [ ] Include at least one Panel with `reactionTags`.
- [ ] Include at least one shareable element marked with a spoiler flag.
- [ ] Include one Translation Pack language when translation rights allow it,
      so language switching, import, and fit-warning demos can use the same
      sample.

## Rights Confirmation

Before adding the sample to Git:

- [ ] The creator owns or controls the artwork, story text, lettering, and
      submitted files.
- [ ] Any collaborators, translators, assistants, font licenses, photos,
      textures, and third-party assets are cleared.
- [ ] The creator understands that GitHub repository inclusion allows public
      cloning and redistribution under the sample content terms.
- [ ] The creator understands that removing content from Git history is not a
      normal guarantee after public release.
- [ ] The creator approved the exact repository inclusion scope.
- [ ] The creator approved the exact public web demo scope.
- [ ] The creator approved OGP/social preview use.
- [ ] The creator approved screenshots or feature GIFs if they will be used.
- [ ] The creator approved translation creation and publication.
- [ ] The creator approved text export and accessibility use.
- [ ] The creator approved the attribution text.

## Terms To State Clearly

The sample rights text should answer these questions without relying on private
email context:

- Who owns the copyright?
- Who may copy the sample content?
- Is commercial sale of the content prohibited?
- Are translations allowed?
- Can translations be committed to Git?
- Can readers or contributors propose translation fixes?
- Can the sample be used in screenshots, documentation, and OGP previews?
- Can the sample be used in automated tests or fixtures?
- What attribution is required?
- What should a maintainer do if the creator requests removal from the live
  site?

Suggested neutral wording:

```text
The manga content in this directory is copyrighted by [Creator Name].
The creator has granted permission to include this sample in the Manga CMS
public repository and public demo site.

You may read, copy, and redistribute this sample as part of the Manga CMS
repository and its public demo usage. You may create and share translations.
You may not sell the manga content itself or present it as your own work.

The Manga CMS source code remains licensed under Apache-2.0. This sample manga
content is licensed separately under these sample-specific terms.
```

Have the creator review this text before use. Adjust it if a lawyer or rights
holder requires different wording.

## Technical Checks

Before committing:

- [ ] `contents/` JSON validates with `pnpm validate:content`.
- [ ] Pack targets validate against the included content.
- [ ] Images are public-safe and use a web-friendly format.
- [ ] No private source files are committed (`.clip`, `.psd`, `.psb`, raw scans,
      unpublished notes, or private exports).
- [ ] No local filesystem paths, staging URLs, tokens, or private contact
      details are committed.
- [ ] The sample does not require runtime DB rows to be readable.
- [ ] The sample can be restored from Git alone, except for any explicitly
      documented external sample asset package.

## Merge Gate

Do not merge sample content until:

- [ ] The rights text is present in the sample directory.
- [ ] The creator has approved GitHub inclusion.
- [ ] The creator has approved public demo publication.
- [ ] The content maintainer has verified attribution.
- [ ] `pnpm build` passes.
- [ ] `pnpm validate:content` passes.
- [ ] A maintainer has reviewed the rendered Reader experience.

## Boundary

This checklist covers public OSS sample content only.

It does not create a public upload product, marketplace, revenue sharing model,
paid checkout, hosted creator account system, or custom-domain SaaS flow.
