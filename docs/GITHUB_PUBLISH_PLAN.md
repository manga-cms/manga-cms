# GitHub Publish Plan

This document records the recommended GitHub publication plan for Manga CMS.

## Account Strategy

Recommended: publish under a GitHub Organization, not a second personal account.

Reasoning:

- An organization can later add maintainers without sharing a personal account.
- Repository ownership can outlive one maintainer's personal identity.
- It is easier to add projects such as docs, examples, hosted services, and
  related tools under one namespace.
- It looks more credible for open source contributors than a disposable personal
  account.

Use a personal account only if the goal is a very small personal experiment.
Avoid creating a second personal account just to separate this project; it adds
account-management overhead and can look less trustworthy.

## Repository Name

Recommended repository name: `manga-cms`.

`mcms` is acceptable as a short internal alias, CLI name, or package nickname,
but it is too ambiguous as the public GitHub repository name.

Comparison:

| Name | Recommendation | Notes |
| --- | --- | --- |
| `manga-cms` | Best default | Clear, searchable, immediately understandable |
| `mcms` | Use as alias | Short, but ambiguous and harder to discover |
| `manga-infrastructure` | Possible later | Broader, but less concrete for first release |
| `open-manga-cms` | Possible | Clear OSS signal, slightly longer |

## Recommended GitHub Shape

Organization:

```text
manga-cms
```

Repository:

```text
manga-cms/manga-cms
```

If the organization name is unavailable, use one of:

```text
open-manga-cms
manga-infra
structured-manga
```

Repository description:

```text
Open source infrastructure for publishing structured manga on the web.
```

Suggested topics:

```text
manga
comics
cms
viewer
translation
webcomics
astro
hono
react
typescript
```

## Visibility

Use `public` when the sample content rights are confirmed.

Until then, either:

- create the repository as private, push, then switch to public later; or
- remove/replace sample content before the first public push.

## Before First Public Push

- [ ] Confirm sample content rights.
- [ ] Decide final owner namespace.
- [ ] Create GitHub organization or choose personal account.
- [ ] Create empty repository with no README, no license, no `.gitignore`.
- [ ] Add the remote locally.
- [ ] Push `main`.
- [ ] Add topics and description.
- [ ] Confirm the README renders correctly on GitHub.

## Local Commands After Repository Creation

Replace `OWNER` with the chosen GitHub account or organization.

```bash
git remote add origin git@github.com:OWNER/manga-cms.git
git push -u origin main
```

If using HTTPS instead of SSH:

```bash
git remote add origin https://github.com/OWNER/manga-cms.git
git push -u origin main
```

## Current Local Status

The local repository has two publication commits after the baseline:

```text
33f7b8c docs: prepare public release
80f47f6 docs: refine reader architecture priorities
```

The local working tree should be clean before adding a remote and pushing.
