import type { GitHubHandoffRecord, GitHubHandoffStatus, GitHubHandoffTargetType } from "./github-handoff-types.js";
import type { GitHubTriageDraft, GitHubTriageDraftItem } from "./github-handoff-draft.js";
import { buildGitHubTriageDraft } from "./github-handoff-draft.js";

export type GitHubHandoffSyncEligibleStatus = Extract<GitHubHandoffStatus, "queued" | "ready">;

export interface GitHubHandoffSyncDryRunInput {
    handoffs: GitHubHandoffRecord[];
    targetsByHandoffId?: Record<string, GitHubTriageDraftItem["target"] | undefined>;
    statuses?: GitHubHandoffSyncEligibleStatus[];
    targetType?: GitHubHandoffTargetType;
    triageGroupKey?: string;
    limit?: number;
    issueTitle?: string;
    generatedAt?: string;
}

export interface GitHubHandoffSyncSkippedItem {
    handoff_id: string;
    reason: string;
}

export interface GitHubHandoffSyncDryRunResult {
    dry_run: true;
    generated_at: string;
    selected_statuses: GitHubHandoffSyncEligibleStatus[];
    eligible_handoff_ids: string[];
    skipped: GitHubHandoffSyncSkippedItem[];
    draft: GitHubTriageDraft;
    github_config_required: string[];
    retry_policy: {
        max_attempts: number;
        initial_backoff_seconds: number;
        max_backoff_seconds: number;
        retry_on: string[];
    };
    deduplication: {
        key_strategy: string;
        keys: string[];
    };
    next_actions: string[];
}

const DEFAULT_STATUSES: GitHubHandoffSyncEligibleStatus[] = ["queued", "ready"];

function dedupKey(handoff: GitHubHandoffRecord): string {
    return [
        handoff.mode,
        handoff.triage_group_key ?? "unfiled",
        handoff.target_type,
        handoff.target_id,
    ].join(":");
}

export function buildGitHubHandoffSyncDryRun(input: GitHubHandoffSyncDryRunInput): GitHubHandoffSyncDryRunResult {
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const statuses = input.statuses?.length ? input.statuses : DEFAULT_STATUSES;
    const skipped: GitHubHandoffSyncSkippedItem[] = [];

    const eligible = input.handoffs
        .filter((handoff) => {
            if (!statuses.includes(handoff.status as GitHubHandoffSyncEligibleStatus)) {
                skipped.push({ handoff_id: handoff.handoff_id, reason: `status ${handoff.status} is not selected` });
                return false;
            }
            if (handoff.mode !== "triage_issue_comment") {
                skipped.push({ handoff_id: handoff.handoff_id, reason: `mode ${handoff.mode} is not supported by dry-run triage sync` });
                return false;
            }
            if (input.targetType && handoff.target_type !== input.targetType) {
                skipped.push({ handoff_id: handoff.handoff_id, reason: `target_type ${handoff.target_type} does not match filter` });
                return false;
            }
            if (input.triageGroupKey && handoff.triage_group_key !== input.triageGroupKey) {
                skipped.push({ handoff_id: handoff.handoff_id, reason: "triage_group_key does not match filter" });
                return false;
            }
            return true;
        })
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(0, input.limit ?? 50);

    const draft = buildGitHubTriageDraft({
        items: eligible.map((handoff) => ({
            handoff,
            target: input.targetsByHandoffId?.[handoff.handoff_id],
        })),
        generatedAt,
        issueTitle: input.issueTitle,
        triageGroupKey: input.triageGroupKey,
    });

    return {
        dry_run: true,
        generated_at: generatedAt,
        selected_statuses: statuses,
        eligible_handoff_ids: eligible.map((handoff) => handoff.handoff_id),
        skipped,
        draft,
        github_config_required: [
            "GITHUB_APP_ID or GITHUB_TOKEN",
            "GITHUB_INSTALLATION_ID when using a GitHub App",
            "GITHUB_REPOSITORY in owner/name form",
            "GITHUB_TRIAGE_ISSUE_NUMBER or a rule for creating grouped triage Issues",
            "GITHUB_WEBHOOK_SECRET for later delivery verification",
        ],
        retry_policy: {
            max_attempts: 5,
            initial_backoff_seconds: 30,
            max_backoff_seconds: 900,
            retry_on: ["network_error", "5xx", "403_secondary_rate_limit", "429_rate_limit"],
        },
        deduplication: {
            key_strategy: "mode:triage_group_key:target_type:target_id",
            keys: eligible.map(dedupKey),
        },
        next_actions: [
            "Review draft.issue_title and draft.issue_body before any GitHub posting.",
            "Store a sync attempt record before implementing real GitHub calls.",
            "On successful future post, mark included handoffs sent with github_url.",
            "On retryable failure, keep handoffs queued or ready and record attempt diagnostics separately.",
        ],
    };
}
