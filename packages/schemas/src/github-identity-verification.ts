import { z } from "zod";
import { GitHubLoginContributorIdentitySchema } from "./contributor-identity.js";

export const GitHubIdentityVerificationMethodSchema = z.enum(["oauth_callback", "trusted_admin"]);

export const GitHubIdentityVerificationStatusSchema = z.enum(["active", "revoked"]);

export const GitHubIdentityTrustedCreateInputSchema = z.object({
    github_login: z.string().trim().min(1).max(39).regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/),
    github_user_id: z.string().max(120).optional(),
    subject_user_id: z.string().max(120).nullable().optional(),
    note: z.string().max(2000).optional(),
}).strict();

export const GitHubOAuthCallbackInputSchema = z.object({
    code: z.string().min(1).max(2000),
    state: z.string().min(1).max(500),
    redirect_uri: z.string().url().optional(),
}).strict();

export const GitHubIdentityVerificationRevokeInputSchema = z.object({
    revoke_note: z.string().max(2000).optional(),
}).strict();

export const GitHubIdentityVerificationRecordSchema = z.object({
    verification_id: z.string().min(1),
    status: GitHubIdentityVerificationStatusSchema,
    verification_method: GitHubIdentityVerificationMethodSchema,
    github_login: z.string().min(1),
    github_user_id: z.string().optional(),
    subject_user_id: z.string().nullable().optional(),
    contributor_identity: GitHubLoginContributorIdentitySchema,
    verified_by: z.string().nullable().optional(),
    note: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    verified_at: z.string(),
    revoked_at: z.string().optional(),
    revoked_by: z.string().nullable().optional(),
    revoke_note: z.string().optional(),
}).strict();

export type GitHubIdentityTrustedCreateInputData = z.infer<typeof GitHubIdentityTrustedCreateInputSchema>;
export type GitHubOAuthCallbackInputData = z.infer<typeof GitHubOAuthCallbackInputSchema>;
export type GitHubIdentityVerificationRevokeInputData = z.infer<typeof GitHubIdentityVerificationRevokeInputSchema>;
export type GitHubIdentityVerificationRecordData = z.infer<typeof GitHubIdentityVerificationRecordSchema>;
