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
- Feedback and Proposal Queue records can preserve contributor identity level.
- Admin API can create private GitHub handoff queue records without calling
  GitHub.

Not implemented in this MVP:

- Pack merge or publication
- Contributor credit/rewards
- Public GitHub Issue posting
- GitHub OAuth/login verification flow
- Real GitHub API issue/comment/PR creation
- Advanced spam/moderation

## Reader Terms

Use reader-facing words:

- Read Mode: `報告する`
- Explore Mode: `提案する`
- Completion: `貢献する`

Do not expose internal terms such as Proposal, Pack, Review Queue, Approve, or Merge in the Reader UI.

## Unified Reader Reporting UX

Reader should have one reporting pipeline even when it has multiple entry
points. `詳細パネル`, long-press context actions, read-complete contribution,
and future quote/clip pages should all open the same report/proposal composer.
The difference between entry points is only the prefilled target and suggested
issue type.

Recommended reader-facing model:

- Center tap or toolbar opens reader controls only.
- `詳細パネル` is for inspecting context and choosing a precise Page, Panel, or
  Bubble target.
- `報告する` always opens the same composer.
- If the user reports from Read Mode, target defaults to the current Page.
- If the user reports from Explore Mode after selecting a Bubble or Panel,
  target uses that Bubble or Panel.
- The composer shows the resolved target in plain language and lets the user
  change category, comment, contributor display, and terms acknowledgement.
- Reader never shows queue terms such as Proposal, Pack, Review, Approved, or
  Merge.

Implementation rule:

```text
Reader target selection
  -> unified report composer
  -> POST /api/v1/feedback
  -> private triage queue
  -> CMS review
  -> optional GitHub handoff or accepted Pack/content change
```

This keeps UI concepts simple: details help the reader select "where"; report
is the single action for "what should be improved".

## Reader Interaction Policy

Reader feedback UI is controlled by the effective `ReaderInteractionPolicy`
defined in `docs/reader-policy-spec.md`.

Relevant fields:

- `reportTargets`: allows `page`, `panel`, `bubble`, and optional `region`
  report targets.
- `feedbackDisplay`: controls whether reader-submitted reports are hidden,
  editor-only, approval-required, or public after moderation.
- `features.feedback`: hides or shows Reader feedback entry points.
- `features.targetSelection`: enables precise Panel/Bubble/Region selection.
- `simpleViewerMode`: applies a reading-first preset that can disable feedback
  and target selection unless explicitly overridden.

The current public feedback API accepts `page_id`, `panel_id`, and `bubble_id`.
If effective policy allows `region` before a first-class Region payload exists,
Reader must submit it as Page feedback and preserve the Region data only in
`source_url` or another review-only note. Region data must not be treated as
canonical content or exposed as a public share/OGP target.

Feedback display policy:

| Policy | Meaning |
| --- | --- |
| `hidden` | Do not show reader reports outside private admin storage. |
| `editors_only` | Show reports only to authenticated CMS editors. |
| `approval_required` | CMS may approve selected report summaries for future public display. |
| `public` | Public display is allowed only for moderated, non-private fields. |

Public display must never expose contributor identity, contact details, private
triage notes, client IP, user agent, or unreviewed comment text without a
separate moderation path.

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

Optional contributor identity:

- `contributor_identity.identity_level = anonymous`
- `contributor_identity.identity_level = display_name`

Missing `contributor_identity` is treated as `anonymous` for backward
compatibility with existing Reader submissions. Public Reader submissions do
not accept `github_login` until a server-side GitHub verification path exists.

Optional contributor terms acknowledgement:

- `contributor_terms_accepted = true`
- `contributor_terms_accepted = false`

The field records whether the Reader showed and accepted contributor terms at
submission time. It is optional for backward compatibility with existing
payloads and older Reader clients.

Submitter status lookup:

- `GET /api/v1/feedback/{feedbackId}/status`

This public endpoint returns only `feedback_id`, `status`, `created_at`, and
optional `triaged_at`. It does not expose comment text, proposed text,
contributor identity, client IP, user agent, or admin triage notes. The
`feedback_id` is treated as a bearer lookup token for MVP; production can add a
separate receipt token if feedback IDs become guessable or externally indexed.

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

## Operational Inbox

For staging and early production, the canonical feedback destination should
remain server-side storage plus CMS triage, not a spreadsheet. The current
file-backed JSONL store is acceptable for local/staging smoke tests, but public
production should move feedback into the runtime database so it can support:

- dedupe by target and normalized text
- status transitions
- contributor identity
- moderation/audit history
- GitHub handoff batching
- export jobs

Spreadsheets are useful as an export surface, not as the source of truth. A
good operator workflow is:

1. Reader submits feedback to the API.
2. API stores it in private runtime state with rate limits and spam guards.
3. CMS triage is the primary review inbox.
4. A one-way export writes selected fields to Google Sheets or CSV for editor
   visibility when needed.
5. GitHub handoff is generated only after triage, grouped by Episode or day.

Do not let unauthenticated Reader submissions write directly to Google Sheets.
It bypasses validation, dedupe, moderation, and contributor identity handling.

## Anti-Spam MVP

- Honeypot field: `website`
- In-memory rate limit by resolved client IP
- `comment` max length: 1000
- `suggested_text` max length: 2000
- `issue_type` and `mode` validation
- `source_url` URL validation
- `user_agent` and client IP captured server-side

For multi-instance production, replace the in-memory limiter with a shared store.
Before any public GitHub handoff is enabled, feedback should be persisted to a
server-side queue first and rate-limited there. The Reader must not create
GitHub Issues directly, and unauthenticated submissions must not produce one
GitHub artifact per submission. Use a shared store such as the production DB,
Cloudflare D1/KV, or an equivalent queue, then sync accepted or triaged items to
GitHub in batches with backoff and deduplication.

Recommended production guards:

- shared per-IP and per-target rate limits
- honeypot plus optional Turnstile or equivalent challenge
- idempotency key or duplicate detection by target and normalized text
- queued GitHub sync with retry/backoff for GitHub secondary rate limits
- daily or Episode-level triage grouping for anonymous and display-name items

## Contributor Identity

Reader feedback and lightweight proposals should support three identity levels:

| Level | Meaning | GitHub display policy |
|-------|---------|-----------------------|
| `anonymous` | No claimed identity. | GitHub handoff is bot-authored and grouped into a triage Issue comment. |
| `display_name` | Contributor enters a public display name without verification. | GitHub handoff is bot-authored and grouped into a triage Issue comment with an unverified display label. |
| `github_login` | Contributor signs in with GitHub and grants the required identity scope. | GitHub handoff may use grouped triage comments by default; direct Issue/PR can be considered only when `verified: true`. |

Anonymous and display-name submissions must not imply verified authorship.
Display names are useful for credit preference, but they are not proof of
identity. If a proposal needs attributable authorship, require GitHub login
before creating the public GitHub artifact or before accepting the proposal.
The current public `/api/v1/feedback` endpoint only accepts anonymous and
display-name identity. Verified `github_login` identity can be preserved on
trusted admin-created Proposal Queue or GitHub handoff records, but the Reader
must not be able to self-assert it.

Verified `github_login` identity is created only through trusted server-side
paths:

- `POST /api/v1/identity/github/oauth/callback` after OAuth token exchange and
  GitHub user lookup are implemented.
- `POST /api/v1/admin/identity/github/verifications` for a trusted admin/manual
  verification path.

The OAuth callback route is currently a contract/API skeleton. It validates the
callback payload and returns 501 until real GitHub OAuth is wired. The trusted
admin path creates private runtime verification state and returns a reusable
`contributor_identity` with `identity_level: "github_login"` and
`verified: true`.

Do not store GitHub tokens in the browser. GitHub Issue/PR creation should go
through a server-side API, serverless function, or GitHub App.

Suggested contributor identity shape:

```ts
type ContributorIdentity =
  | { identity_level: "anonymous" }
  | { identity_level: "display_name"; display_name: string }
  | {
      identity_level: "github_login";
      github_login: string;
      github_user_id?: string;
      verified: true;
    };
```

## GitHub Integration Path

GitHub integration should be staged so public repository noise and spam are
controlled:

1. Reader submits feedback/proposal into the private feedback queue.
2. Server-side API applies validation, rate limits, bot checks, and duplicate
   detection before persisting the item.
3. CMS triage reviews target context, spam risk, contributor identity, and
   contributor terms.
4. A scheduled or operator-triggered sync publishes only reviewed items to
   GitHub:
   - Anonymous and display-name-only items are appended as bot comments to a
     daily or Episode-level triage Issue, for example
     `[Triage] ep001 Feedback (2026-05-31)`.
   - Verified `github_login` items may create standalone Issues when the
     project wants public discussion for that contributor's proposal.
   - Accepted Pack or content changes may create GitHub PRs for source-
     controlled `packs/` or `contents/` changes.
5. If the contributor used GitHub login, include the verified GitHub username
   in the Issue/PR body and optionally request review from that user when the
   workflow allows it.

For anonymous and display-name-only submissions, GitHub artifacts should be
bot-authored, grouped into triage Issues by default, and clearly marked as
anonymous or unverified. This avoids turning spam into public repository noise
and reduces the risk of GitHub API secondary rate limits or bot account
restrictions.

The current API skeleton stores GitHub handoff intent as private runtime state
only:

- `GET /api/v1/admin/github-handoffs`
- `POST /api/v1/admin/github-handoffs`
- `POST /api/v1/admin/github-handoffs/triage-draft`
- `POST /api/v1/admin/github-handoffs/sync-dry-run`
- `GET /api/v1/admin/github-handoffs/sync-attempts`
- `POST /api/v1/admin/github-handoffs/sync-attempts/planned`
- `GET /api/v1/admin/github-handoffs/sync-attempts/{attemptId}`
- `PUT /api/v1/admin/github-handoffs/sync-attempts/{attemptId}/status`
- `GET /api/v1/admin/github-handoffs/{handoffId}`
- `PUT /api/v1/admin/github-handoffs/{handoffId}/status`
- `POST /api/v1/admin/feedback/{feedbackId}/github-handoff`
- `POST /api/v1/admin/proposals/{proposalId}/github-handoff`

Default handoff mode is `triage_issue_comment`. `direct_issue` and `direct_pr`
are rejected unless `contributor_identity.identity_level` is `github_login` and
`verified` is `true`. These routes do not call GitHub. The `triage-draft`
endpoint returns Markdown for an operator or later sync worker to post after
review; it also leaves queue status unchanged.

The `sync-dry-run` endpoint is the future worker contract. It selects
`queued`/`ready` `triage_issue_comment` handoffs, returns the generated triage
draft, and reports what would be posted without calling GitHub or changing
status. Its response also documents the future GitHub configuration
requirements:

- `GITHUB_APP_ID` or `GITHUB_TOKEN`
- `GITHUB_INSTALLATION_ID` for GitHub App installs
- `GITHUB_REPOSITORY` in `owner/name` form
- `GITHUB_TRIAGE_ISSUE_NUMBER` or a grouping rule for creating triage Issues
- `GITHUB_WEBHOOK_SECRET` for later delivery verification

Retry/backoff should use bounded exponential backoff for network errors, 5xx,
GitHub secondary rate limits, and 429 rate limits. Deduplication should use a
stable key based on `mode:triage_group_key:target_type:target_id`, and a real
worker should persist sync attempts before making GitHub API calls.

### Sync Worker Next Phase

The next phase after `sync-dry-run` is a worker that can claim reviewed handoff
records and persist sync attempts, but still uses the dry-run output as the
source of truth for what would be posted. The worker must not read directly
from Reader input and must not create one GitHub artifact per anonymous or
display-name submission.

Minimum sync-attempt state:

- `attempt_id`
- `handoff_ids`
- `triage_group_key`
- `target_repository`
- `target_issue_number` or planned Issue grouping rule
- `idempotency_key`
- `status`: `planned`, `in_progress`, `succeeded`, `retryable_failed`,
  `permanent_failed`, or `canceled`
- `attempt_count`
- `last_error`
- `next_retry_at`
- `rate_limit_reset_at`
- `github_url` once a comment, Issue, or PR URL exists
- `created_at` and `updated_at`

File-backed MVP can store attempts next to `github-handoffs.jsonl` under
`GITHUB_HANDOFF_DIR` with a local lock. That is suitable for local development
and single-host operation only. Before running multiple workers, serverless
instances, or scheduled jobs concurrently, move sync-attempt state to
`packages/db` and enforce a unique idempotency key plus claim/update
transactions there.

The current API skeleton implements only planned attempt persistence:

- `POST /api/v1/admin/github-handoffs/sync-attempts/planned` recomputes the
  dry-run result from current handoff state and stores a planned attempt.
- The request uses the same selection fields as `sync-dry-run` and adds
  `target_repository`, plus either `target_issue_number` for an existing
  triage Issue or `issue_grouping_rule` for future Issue selection.
- Empty dry-run results are rejected so operators do not create attempts with
  no handoffs.
- Active attempts with the same idempotency key return the existing record with
  `deduped: true`.
- `PUT /api/v1/admin/github-handoffs/sync-attempts/{attemptId}/status` can
  move attempts to `in_progress`, `retryable_failed`, `permanent_failed`,
  `canceled`, or `succeeded`, and can persist `attempt_count`, `last_error`,
  `next_retry_at`, and `rate_limit_reset_at`.
- `succeeded` requires `github_url`, but the status route still does not post
  to GitHub or mark handoffs `sent`.
- No route in this skeleton posts to GitHub or marks handoffs `sent`.

Worker claim flow:

1. List `planned` attempts and choose records whose `next_retry_at` is missing
   or in the past.
2. Claim one attempt per triage group by updating it to `in_progress` and
   incrementing `attempt_count`.
3. Recompute `sync-dry-run` using the attempt's selection fields.
4. Compare the recomputed `handoff_ids`, draft body hash, repository, triage
   group, and triage Issue target with the stored attempt.
5. If the attempt is still valid, perform preflight checks. Future GitHub
   posting can only happen after those checks pass.
6. On a future successful GitHub response, update the attempt to `succeeded`
   with `github_url`, then mark each included handoff `sent` with the same URL.

Lifecycle transition conditions:

- `planned` -> `in_progress`: worker or operator claims the attempt for a
  single execution slot.
- `in_progress` -> `retryable_failed`: network error, GitHub 5xx, 429,
  secondary rate limit, or retry-after/rate-limit reset response. Store
  `last_error`, incremented `attempt_count`, `next_retry_at`, and
  `rate_limit_reset_at` when available.
- `in_progress` -> `permanent_failed`: invalid configuration, missing
  credentials, 401/403 permission error, missing repository or Issue target,
  stale dry-run content, or identity/mode violation.
- `planned` or `in_progress` -> `canceled`: operator cancels work before a
  durable GitHub URL exists.
- `in_progress` -> `succeeded`: GitHub returns or the operator records a
  durable comment, Issue, or PR URL. `github_url` is required.

GitHub posting preflight, before any real API call:

- Server-side GitHub App or token credentials are present and scoped only to
  the target repository.
- `target_repository` and `target_issue_number` or grouping rule resolve to the
  expected triage destination.
- The attempt idempotency key is unique among active attempts, and no included
  handoff is already `sent`.
- The generated draft body contains machine-readable metadata for every
  included handoff.
- Anonymous and display-name identities are still grouped as bot-authored
  triage comments; direct Issue/PR routes are excluded unless verified
  `github_login` is explicitly allowed by a separate workflow.
- Current rate-limit state allows the request. If not, leave the attempt
  retryable with `rate_limit_reset_at`.
- CMS operators can review the same safety checklist on the sync attempt row:
  repository, Issue target, idempotency key, included handoffs, identity level
  metadata, and rate-limit/reset state. This is display-only and must not
  perform the real GitHub API call.

Rate limit and retry rules:

- Run one worker claim per triage group at a time.
- Recompute the dry-run result immediately before posting so stale queued state
  is not published.
- Treat network errors, GitHub 5xx, 429, and secondary rate-limit responses as
  retryable.
- Use bounded exponential backoff with jitter, starting around 30 seconds and
  capping around 15 minutes for MVP.
- Honor GitHub `X-RateLimit-Reset` or retry-after style headers when present.
- Treat missing credentials, invalid repository or Issue configuration, 401,
  403 permission failures, and 404/410 target failures as permanent operator
  failures until configuration changes.
- Store secondary rate-limit failures as `retryable_failed` with a conservative
  `next_retry_at` even if GitHub does not send an exact reset time.

Dedupe rules:

- Compute the handoff-level dedupe key as
  `mode:triage_group_key:target_type:target_id`.
- Compute the sync-attempt idempotency key from repository, triage group,
  sorted `handoff_ids`, and a hash of the generated draft body.
- Skip handoffs that are already `sent` or are included in an in-flight attempt
  with the same idempotency key.
- Mark handoffs `sent` only after GitHub returns a durable URL.
- If a post succeeds but the status update fails, the retry path must search
  existing attempts or GitHub metadata before posting a duplicate comment.
- Include the attempt idempotency key in the future GitHub metadata block so a
  retry can detect an already-posted comment before creating another one.

Identity alignment:

- `anonymous` remains bot-authored and grouped into a triage Issue comment.
- `display_name` remains bot-authored, grouped, and labeled unverified.
- Verified `github_login` may be shown as a verified contributor in the triage
  body, but the default route is still grouped triage.
- Direct Issue or PR sync is a separate future workflow and must keep the
  existing requirement for `identity_level: "github_login"` with
  `verified: true`.

GitHub Issue and comment bodies should include a machine-readable metadata
block so CMS tools can later parse the artifact and connect it back to Proposal
Queue or Pack draft records.

Example:

```markdown
Proposed by: Nana (unverified)

**Issue Type:** better_translation
**Target:** `rain-world/ep01/page-003/panel-002/bubble-001`
**Current:** If you have nowhere to return to...
**Proposed:** If you have no place to go back to...
**Comment:** Tone adjustment proposal.

<!-- manga-cms-feedback
{
  "feedbackId": "fb_123",
  "seriesId": "rain-world",
  "episodeId": "ep01",
  "pageId": "page-003",
  "panelId": "panel-002",
  "bubbleId": "bubble-001",
  "issueType": "better_translation",
  "identity": {
    "identity_level": "display_name",
    "display_name": "Nana"
  }
}
-->
```

## CMS Triage

CMS can list private feedback, inspect target context fields, and update
triage status:

- `GET /api/v1/admin/feedback`
- `GET /api/v1/admin/feedback/{feedbackId}`
- `PUT /api/v1/admin/feedback/{feedbackId}/status`
- `POST /api/v1/admin/feedback/{feedbackId}/proposal`

Statuses:

- `new`
- `triaged`
- `closed`

Triage does not mutate canonical content or Packs. CMS may convert feedback
into a Proposal Queue record. Conversion marks the feedback as triaged and
creates a private proposal record; Pack adoption remains a separate workflow.

Operational boundary for the file-backed MVP:

- `feedback/feedback.jsonl` is sufficient for the CMS `/feedback` inbox in
  local, staging, and single-operator smoke workflows. It supports listing,
  detail view, status updates, and conversion into Proposal Queue records.
- Feedback-to-Proposal conversion prevents normal duplicate clicks by checking
  `source_feedback_id` before creating a Proposal and by allowing conversion
  only while feedback is `new`.
- This duplicate prevention is application-level, not a durable uniqueness
  guarantee. Before concurrent admins, background workers, or multi-instance
  API deployments can convert feedback, move feedback/proposal state to the
  runtime DB and add a unique constraint on `source_feedback_id`.
- GitHub handoff can target either the original feedback or the derived
  Proposal. Once feedback has been converted, new handoffs should target the
  Proposal so the triage draft reflects reviewer context. Any pre-existing
  feedback-targeted handoff for the same item should be canceled or excluded
  before planning sync, because handoff dedupe keys are scoped by
  `target_type` and `target_id`.
- Translation Pack Draft import remains separate from triage conversion and
  GitHub handoff. Import applies only to runtime Pack draft entries, uses
  `source_text` for canonical `Bubble.textOriginal` mismatch warnings, and
  must not write canonical Episode JSON.
