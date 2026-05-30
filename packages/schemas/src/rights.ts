import { z } from "zod";

export const RightsRoleSchema = z.enum([
    "owner",
    "editor",
    "translator",
    "reviewer",
    "contributor",
    "moderator",
    "viewer",
    "original_rights_holder",
    "translation_reviewer",
    "footnote_contributor",
    "pack_maintainer",
    "publisher",
]);

export const RightsPermissionSchema = z.enum([
    "propose_translation",
    "propose_footnote",
    "edit_structure",
    "edit_translation",
    "review_translation",
    "review_footnote",
    "approve_translation",
    "approve_footnote",
    "publish_pack",
    "manage_rights",
    "moderate_proposals",
    "commercial_use",
]);

export const RightsUsageSchema = z.enum([
    "free_view",
    "paid_view",
    "promotional",
    "commercial_distribution",
]);

export const RightsScopeSchema = z.object({
    series_id: z.string().min(1).optional(),
    episode_id: z.string().min(1).optional(),
    language: z.string().min(1).max(16).optional(),
    pack_id: z.string().min(1).optional(),
    usage: z.array(RightsUsageSchema).min(1).optional(),
    territory: z.string().min(1).max(80).optional(),
}).strict();

export const RightsGrantCreateInputSchema = z.object({
    subject_user_id: z.string().min(1).max(120),
    role: RightsRoleSchema,
    permissions: z.array(RightsPermissionSchema).min(1),
    scope: RightsScopeSchema,
    starts_at: z.string().datetime().optional(),
    ends_at: z.string().datetime().nullable().optional(),
    granted_by: z.string().min(1).max(120).nullable().optional(),
    notes: z.string().max(2000).optional(),
}).strict();

export const RightsGrantRecordSchema = RightsGrantCreateInputSchema.extend({
    grant_id: z.string().min(1),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    revoked_at: z.string().datetime().nullable().optional(),
}).strict();

export const RightsPermissionCheckInputSchema = z.object({
    user_id: z.string().min(1).max(120),
    permission: RightsPermissionSchema,
    scope: RightsScopeSchema,
}).strict();

export const RightsPermissionCheckResponseSchema = z.object({
    allowed: z.boolean(),
    matched_grant_ids: z.array(z.string().min(1)),
    reason: z.string().optional(),
}).strict();

export type RightsGrantCreateInputData = z.infer<typeof RightsGrantCreateInputSchema>;
export type RightsGrantRecordData = z.infer<typeof RightsGrantRecordSchema>;
export type RightsPermissionCheckInputData = z.infer<typeof RightsPermissionCheckInputSchema>;
export type RightsPermissionCheckResponseData = z.infer<typeof RightsPermissionCheckResponseSchema>;
