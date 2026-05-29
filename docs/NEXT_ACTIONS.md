# Next Actions

This is the practical task split for starting the first public manga site.

## Current State

- The repository has been pushed to `https://github.com/manga-cms/manga-cms`.
- The codebase can be published as open source.
- A free manga site can be launched once prepared page images and JSON content
  are available.
- Commercial sale and gated production reading still need operations work.

## Human Tasks

- Confirm whether the existing sample content can remain public.
- Choose the first real series to publish.
- Confirm rights for artwork, story, lettering, translations, and any comments.
- Provide page images for the first episode.
- Decide whether the first launch should be free-only or include gated content.
- Decide the public positioning: experimental OSS, creator tool, or manga site.

## Codex Tasks

- Convert provided manuscript/page assets into `contents/` structure.
- Create or validate `series.json` and `episode.json`.
- Add panel and bubble metadata where needed for quote/clip features.
- Implement `normal` reading mode and `study` mode.
- Add share policy and spoiler policy schemas.
- Add official Quote / Clip / Reaction data structures.
- Add Page OGP first, then official Quote / Clip / Reaction OGP.
- Keep the Obsidian project manual and GitHub docs in sync.

## Suggested Next Sprint

1. Confirm sample-content rights.
2. Add GitHub repository description and topics.
3. Add the first real episode assets.
4. Validate viewer/API rendering locally.
5. Implement normal/study mode separation.
6. Add official Quote / Clip records for the first episode.
