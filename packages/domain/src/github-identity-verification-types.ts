import type { GitHubLoginContributorIdentity } from "./contributor-identity.js";

export type GitHubIdentityVerificationMethod = "oauth_callback" | "trusted_admin";

export type GitHubIdentityVerificationStatus = "active" | "revoked";

export interface GitHubIdentityVerificationCreateInput {
    github_login: string;
    github_user_id?: string;
    subject_user_id?: string | null;
    verification_method: GitHubIdentityVerificationMethod;
    verified_by?: string | null;
    note?: string;
}

export interface GitHubIdentityVerificationRecord extends GitHubIdentityVerificationCreateInput {
    verification_id: string;
    status: GitHubIdentityVerificationStatus;
    contributor_identity: GitHubLoginContributorIdentity;
    created_at: string;
    updated_at: string;
    verified_at: string;
    revoked_at?: string;
    revoked_by?: string | null;
    revoke_note?: string;
}

export interface GitHubOAuthCallbackInput {
    code: string;
    state: string;
    redirect_uri?: string;
}
