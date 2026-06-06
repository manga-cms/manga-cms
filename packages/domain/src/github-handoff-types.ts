import type { ContributorIdentity } from "./contributor-identity.js";

export type GitHubHandoffTargetType = "feedback" | "proposal";

export type GitHubHandoffMode = "triage_issue_comment" | "direct_issue" | "direct_pr";

export type GitHubHandoffStatus = "queued" | "ready" | "sent" | "failed" | "canceled";

export interface GitHubHandoffCreateInput {
    target_type: GitHubHandoffTargetType;
    target_id: string;
    mode?: GitHubHandoffMode;
    contributor_identity?: ContributorIdentity;
    requested_by?: string | null;
    triage_group_key?: string;
    title?: string;
    body?: string;
    metadata?: Record<string, unknown>;
}

export interface GitHubHandoffRecord extends GitHubHandoffCreateInput {
    handoff_id: string;
    mode: GitHubHandoffMode;
    status: GitHubHandoffStatus;
    created_at: string;
    updated_at: string;
    github_url?: string;
    error_message?: string;
    sent_at?: string;
}

export function isDirectGitHubHandoffMode(mode: GitHubHandoffMode): boolean {
    return mode === "direct_issue" || mode === "direct_pr";
}
