# Creator Collaboration Spec

This document defines how `manga-cms.com` can invite a small number of creators
to provide public demo or showcase material without becoming a posting
platform.

## Goal

`manga-cms.com` needs public-safe content to demonstrate the structured manga
reader. The safest first step is a curated collaboration program, not a public
submission product.

The program should:

- Recruit a small number of creators by email or form.
- Let maintainers review every work before publication.
- Keep creator copyright and sample-content licensing explicit.
- Separate official-site demo use from GitHub repository redistribution.
- Avoid user accounts, automatic publishing, upload moderation, and posting-site
  operations.

## Non-Goals

- No public posting UI.
- No automatic ingestion from an untrusted browser upload.
- No self-serve publishing.
- No marketplace, payouts, or creator dashboard.
- No assumption that submitted works can be committed to GitHub.
- No change to the API, database, entitlement, or payment model.

## Collaboration Tiers

Use three separate permission tiers. A creator can approve one tier without
approving the others.

| Tier | Use | Repository inclusion | Notes |
| --- | --- | --- | --- |
| Showcase listing | Link and short description on `manga-cms.com/showcase` | No | Lowest-friction entry |
| Demo publication | Work is readable on `manga-cms.com/demo` or a staging demo URL | No by default | Good first target |
| OSS sample content | Work data and assets are committed to the public repo | Yes | Requires explicit license |

Do not merge the tiers in consent text. GitHub repository inclusion is a
stronger grant because it allows redistribution by repository users.

## Recommended First Flow

1. Publish a simple collaboration page on `manga-cms.com`.
2. Accept interest by a form or mail link.
3. Review the work, rights, and intended use manually.
4. Confirm which tier is approved.
5. Prepare the Series data locally.
6. Share a staging preview URL with the creator.
7. Publish only after explicit final approval.
8. Keep a record of consent, license, attribution, and takedown contact.

Use a form for structured intake, then continue by email for context and final
approval.

## Intake Fields

Minimum fields:

- Creator name.
- Public display name.
- Contact email.
- Work title.
- Work URL or file-sharing URL.
- Number of Pages or expected sample range.
- Preferred language.
- Whether English translation is desired.
- Whether the creator wants only a showcase listing.
- Whether demo publication on `manga-cms.com` is allowed.
- Whether GitHub repository inclusion is allowed.
- Whether screenshots can be used in project pages.
- Copyright ownership confirmation.
- Third-party asset confirmation.
- Preferred attribution.
- Public stop-request contact or private takedown contact.

Optional fields:

- Creator site or SNS URL.
- Existing license, if any.
- Notes about age rating, spoilers, sensitive content, or publication timing.
- Whether translation, footnote, commentary, learning, or accessibility Packs
  may be created.

## Rights Confirmation

Before publication, confirm:

- The creator owns or controls the submitted artwork and text.
- Lettering, fonts, photos, textures, and other assets are cleared.
- Any translator or collaborator rights are cleared.
- The creator understands the difference between web demo publication and public
  repository inclusion.
- The creator can request removal from the live site.
- Removal from Git history is not a normal guarantee if content is committed to
  the public repository.

If any of these are unclear, keep the work out of public demo and GitHub.

## Suggested Page Copy

Heading:

```text
デモ掲載に協力してくれるマンガ作品を募集しています
```

Body:

```text
manga-cms は、マンガを読みやすく、共有しやすく、翻訳しやすくするための
オープンソース基盤です。

現在、この仕組みを実際の作品で検証するため、短編・数ページのマンガ作品を
少数募集しています。
```

Notes:

```text
すべての応募作品が掲載されるわけではありません。
掲載前に内容・権利・公開範囲を確認します。
作品の著作権は作家本人に残ります。
```

Consent separation:

```text
manga-cms.com 上のデモ掲載と、GitHub リポジトリへのサンプル同梱は別の許諾です。
GitHub への同梱を希望しない場合でも、デモ掲載や Showcase 掲載だけで参加できます。
```

## Review Criteria

Early collaborations should prefer:

- Short works that can be reviewed quickly.
- Clear ownership and attribution.
- A small Page count.
- Art that works in mobile reading.
- Content that can demonstrate at least one structured feature:
  - Panel selection.
  - Bubble selection.
  - Quote link.
  - Clip link.
  - Feedback target.
  - Translation or footnote Pack.

Avoid early collaborations that require:

- Complex coauthor rights.
- Sensitive takedown handling.
- Adult, violent, or controversial moderation decisions.
- Large assets or high bandwidth.
- Paid access, subscriptions, or royalty accounting.

## Operational Boundary

This program is a maintainer-run collaboration queue.

It may use:

- Email.
- A form service.
- GitHub Issues for developer-facing coordination.
- Manual staging previews.

It should not use:

- Public uploads.
- Automatic publication.
- Shared creator accounts.
- Public moderation queues.
- Direct browser-to-GitHub posting.

If collaboration volume grows, move to a dedicated operations spec before
building product features.

## Relationship To Future Posting

The collaboration program is not a stepping stone that automatically becomes a
posting site. It is a way to obtain public-safe demo material while validating
the reader and CMS.

A posting site still requires the conditions listed in
`docs/public-release-roadmap.md`: account identity, moderation, takedown,
rights review, storage quotas, operations, and governance.
