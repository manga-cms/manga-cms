import { z } from "zod";
import { ContributorIdentitySchema } from "./contributor-identity.js";

export const GitHubHandoffTargetTypeSchema = z.enum(["feedback", "proposal"]);

export const GitHubHandoffModeSchema = z.enum(["triage_issue_comment", "direct_issue", "direct_pr"]);

export const GitHubHandoffStatusSchema = z.enum(["queued", "ready", "sent", "failed", "canceled"]);

export const GitHubHandoffCreateInputSchema = z.object({
    target_type: GitHubHandoffTargetTypeSchema,
    target_id: z.string().min(1),
    mode: GitHubHandoffModeSchema.optional(),
    contributor_identity: ContributorIdentitySchema.optional(),
    requested_by: z.string().max(120).nullable().optional(),
    triage_group_key: z.string().max(200).optional(),
    title: z.string().max(200).optional(),
    body: z.string().max(8000).optional(),
    metadata: z.record(z.unknown()).optional(),
}).strict();

export const GitHubHandoffStatusUpdateInputSchema = z.object({
    status: GitHubHandoffStatusSchema,
    github_url: z.string().url().optional(),
    error_message: z.string().max(2000).optional(),
}).strict();

export const GitHubTriageDraftInputSchema = z.object({
    status: GitHubHandoffStatusSchema.optional().default("queued"),
    target_type: GitHubHandoffTargetTypeSchema.optional(),
    triage_group_key: z.string().trim().min(1).max(200).optional(),
    limit: z.number().int().min(1).max(200).optional().default(50),
    issue_title: z.string().trim().min(1).max(200).optional(),
}).strict();

export const GitHubHandoffSyncEligibleStatusSchema = z.enum(["queued", "ready"]);

export const GitHubHandoffSyncDryRunInputSchema = z.object({
    statuses: z.array(GitHubHandoffSyncEligibleStatusSchema).min(1).max(2).optional(),
    target_type: GitHubHandoffTargetTypeSchema.optional(),
    triage_group_key: z.string().trim().min(1).max(200).optional(),
    limit: z.number().int().min(1).max(200).optional().default(50),
    issue_title: z.string().trim().min(1).max(200).optional(),
}).strict();

export const GitHubHandoffSyncAttemptStatusSchema = z.enum([
    "planned",
    "in_progress",
    "succeeded",
    "retryable_failed",
    "permanent_failed",
    "canceled",
]);

export const GitHubHandoffSyncAttemptCreateInputSchema = GitHubHandoffSyncDryRunInputSchema.extend({
    target_repository: z.string().trim().regex(/^[^/\s]+\/[^/\s]+$/, "Expected owner/name repository"),
    target_issue_number: z.number().int().positive().optional(),
    issue_grouping_rule: z.string().trim().min(1).max(200).optional(),
    max_attempts: z.number().int().min(1).max(10).optional(),
    next_retry_at: z.string().datetime().optional(),
    rate_limit_reset_at: z.string().datetime().optional(),
}).strict().refine(
    (value) => value.target_issue_number !== undefined || value.issue_grouping_rule !== undefined,
    {
        message: "target_issue_number or issue_grouping_rule is required",
        path: ["target_issue_number"],
    },
);

export const GitHubHandoffSyncAttemptStatusUpdateInputSchema = z.object({
    status: z.enum(["in_progress", "succeeded", "retryable_failed", "permanent_failed", "canceled"]),
    attempt_count: z.number().int().min(0).max(100).optional(),
    last_error: z.string().trim().max(2000).optional(),
    next_retry_at: z.string().datetime().optional(),
    rate_limit_reset_at: z.string().datetime().optional(),
    github_url: z.string().url().optional(),
}).strict().refine(
    (value) => value.status !== "succeeded" || value.github_url !== undefined,
    {
        message: "github_url is required when status is succeeded",
        path: ["github_url"],
    },
);

export type GitHubHandoffCreateInputData = z.infer<typeof GitHubHandoffCreateInputSchema>;
export type GitHubHandoffStatusUpdateInputData = z.infer<typeof GitHubHandoffStatusUpdateInputSchema>;
export type GitHubTriageDraftInputData = z.infer<typeof GitHubTriageDraftInputSchema>;
export type GitHubHandoffSyncDryRunInputData = z.infer<typeof GitHubHandoffSyncDryRunInputSchema>;
export type GitHubHandoffSyncAttemptCreateInputData = z.infer<typeof GitHubHandoffSyncAttemptCreateInputSchema>;
export type GitHubHandoffSyncAttemptStatusUpdateInputData = z.infer<typeof GitHubHandoffSyncAttemptStatusUpdateInputSchema>;
