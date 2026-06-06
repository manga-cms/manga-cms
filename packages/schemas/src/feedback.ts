import { z } from "zod";
import { PublicFeedbackContributorIdentitySchema } from "./contributor-identity.js";

export const FeedbackIssueTypeSchema = z.enum([
    "typo",
    "mistranslation",
    "better_translation",
    "missing_note",
    "display",
    "broken_link",
    "spoiler",
    "other",
]);

export const ReaderModeSchema = z.enum(["read", "explore", "completion"]);

export const FeedbackPayloadSchema = z.object({
    series_id: z.string().min(1),
    episode_id: z.string().min(1),
    page_id: z.string().min(1).nullable().optional(),
    panel_id: z.string().min(1).nullable().optional(),
    bubble_id: z.string().min(1).nullable().optional(),
    mode: ReaderModeSchema,
    issue_type: FeedbackIssueTypeSchema,
    comment: z.string().max(1000).optional(),
    lang: z.string().max(16).optional(),
    current_text: z.string().max(2000).optional(),
    current_translation: z.string().max(2000).optional(),
    suggested_text: z.string().max(2000).optional(),
    user_id: z.string().max(120).nullable().optional(),
    contributor_identity: PublicFeedbackContributorIdentitySchema.optional(),
    contributor_terms_accepted: z.boolean().optional(),
    source_url: z.string().url(),
    user_agent: z.string().max(500).optional(),
    client_time: z.string().max(80).optional(),
    website: z.string().max(200).optional(),
}).strict();

export type FeedbackPayloadData = z.infer<typeof FeedbackPayloadSchema>;
