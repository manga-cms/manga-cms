import { z } from "zod";
import { ContributorIdentitySchema } from "./contributor-identity.js";

export const ProposalKindSchema = z.enum(["translation", "typo", "footnote", "commentary", "tag", "structure"]);

export const ProposalStatusSchema = z.enum(["new", "triaged", "accepted", "rejected", "closed"]);

export const ProposalCreateInputSchema = z.object({
    kind: ProposalKindSchema,
    status: ProposalStatusSchema.optional(),
    source_feedback_id: z.string().min(1).nullable().optional(),
    series_id: z.string().min(1),
    episode_id: z.string().min(1),
    page_id: z.string().min(1).nullable().optional(),
    panel_id: z.string().min(1).nullable().optional(),
    bubble_id: z.string().min(1).nullable().optional(),
    lang: z.string().max(16).optional(),
    source_text: z.string().max(4000).optional(),
    current_text: z.string().max(4000).optional(),
    current_translation: z.string().max(4000).optional(),
    suggested_text: z.string().max(4000).optional(),
    comment: z.string().max(2000).optional(),
    proposer_id: z.string().max(120).nullable().optional(),
    contributor_identity: ContributorIdentitySchema.optional(),
    source_url: z.string().url().optional(),
}).strict().superRefine((value, ctx) => {
    if (value.status !== undefined && value.status !== "new") {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "status must be new when creating a proposal",
            path: ["status"],
        });
    }
    if (value.kind !== "translation") return;
    for (const key of ["page_id", "panel_id", "bubble_id", "lang", "suggested_text"] as const) {
        if (!value[key]) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${key} is required for translation proposals`,
                path: [key],
            });
        }
    }
    if (!value.source_text && !value.current_text) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "source_text is required for translation proposals",
            path: ["source_text"],
        });
    }
});

export const ProposalStatusUpdateInputSchema = z.object({
    status: ProposalStatusSchema,
    review_note: z.string().max(2000).optional(),
}).strict();

export type ProposalCreateInputData = z.infer<typeof ProposalCreateInputSchema>;
export type ProposalStatusUpdateInputData = z.infer<typeof ProposalStatusUpdateInputSchema>;
