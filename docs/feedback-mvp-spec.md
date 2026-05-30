# Reader Feedback MVP Spec

Reader feedback is a lightweight reporting and proposal path.
It must not modify canonical content, packs, or rights.

## Scope

Implemented in this MVP:

- Bubble, panel, and page metadata can carry feedback/share flags.
- Reader supports Read Mode and Explore Mode.
- Read Mode keeps feedback UI hidden until right-click or long-press on a target.
- Explore Mode can show target context and proposal/report actions.
- Completion card can send episode-level feedback.
- `POST /api/v1/feedback` validates and stores feedback privately.
- Feedback is file-backed JSONL by default.

Not implemented in this MVP:

- Proposal Queue
- Pack merge or publication
- Contributor credit/rewards
- Public GitHub Issue posting
- Advanced spam/moderation

## Reader Terms

Use reader-facing words:

- Read Mode: `報告する`
- Explore Mode: `提案する`
- Completion: `貢献する`

Do not expose internal terms such as Proposal, Pack, Review Queue, Approve, or Merge in the Reader UI.

## API

Endpoint:

```text
POST /api/v1/feedback
```

Required fields:

- `series_id`
- `episode_id`
- `mode`
- `issue_type`
- `source_url`

Optional targeting fields:

- `page_id`
- `panel_id`
- `bubble_id`

Issue types:

- `typo`
- `mistranslation`
- `better_translation`
- `missing_note`
- `display`
- `broken_link`
- `spoiler`
- `other`

Modes:

- `read`
- `explore`
- `completion`

## Storage

Default storage:

```text
feedback/feedback.jsonl
```

Configure with:

```text
FEEDBACK_DIR=/private/path/to/feedback
```

Feedback storage is private runtime state and is ignored by Git.

## Anti-Spam MVP

- Honeypot field: `website`
- In-memory rate limit by resolved client IP
- `comment` max length: 1000
- `suggested_text` max length: 2000
- `issue_type` and `mode` validation
- `source_url` URL validation
- `user_agent` and client IP captured server-side

For multi-instance production, replace the in-memory limiter with a shared store.

## CMS Triage

CMS can list private feedback, inspect target context fields, and update
triage status:

- `GET /api/v1/admin/feedback`
- `GET /api/v1/admin/feedback/{feedbackId}`
- `PUT /api/v1/admin/feedback/{feedbackId}/status`

Statuses:

- `new`
- `triaged`
- `closed`

Triage does not mutate canonical content, Packs, or proposals. Converting
approved feedback into proposal records remains a future workflow.
