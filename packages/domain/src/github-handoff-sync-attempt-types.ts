import type { GitHubHandoffSyncDryRunResult } from "./github-handoff-sync.js";

export type GitHubHandoffSyncAttemptStatus =
    | "planned"
    | "in_progress"
    | "succeeded"
    | "retryable_failed"
    | "permanent_failed"
    | "canceled";

export interface GitHubHandoffSyncAttemptCreateInput {
    dryRun: GitHubHandoffSyncDryRunResult;
    targetRepository: string;
    targetIssueNumber?: number;
    issueGroupingRule?: string;
    maxAttempts?: number;
    nextRetryAt?: string;
    rateLimitResetAt?: string;
}

export interface GitHubHandoffSyncAttemptStatusUpdateInput {
    status: Exclude<GitHubHandoffSyncAttemptStatus, "planned">;
    attemptCount?: number;
    lastError?: string;
    nextRetryAt?: string;
    rateLimitResetAt?: string;
    githubUrl?: string;
}

export interface GitHubHandoffSyncAttemptRecord {
    attempt_id: string;
    status: GitHubHandoffSyncAttemptStatus;
    handoff_ids: string[];
    selected_statuses: GitHubHandoffSyncDryRunResult["selected_statuses"];
    skipped: GitHubHandoffSyncDryRunResult["skipped"];
    target_repository: string;
    target_issue_number?: number;
    issue_grouping_rule?: string;
    triage_group_key?: string;
    draft: GitHubHandoffSyncDryRunResult["draft"];
    draft_body_hash: string;
    idempotency_key: string;
    dedupe_keys: string[];
    retry_policy: GitHubHandoffSyncDryRunResult["retry_policy"];
    attempt_count: number;
    max_attempts: number;
    next_retry_at?: string;
    rate_limit_reset_at?: string;
    last_error?: string;
    github_url?: string;
    created_at: string;
    updated_at: string;
}
