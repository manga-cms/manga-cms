import { z } from "zod";
import { PackClassSchema, PackTypeSchema } from "./content.js";

export const PackDraftStatusSchema = z.enum(["draft", "in_review", "approved", "published", "archived"]);

export const PackDraftEntryTargetSchema = z.object({
    series_id: z.string().min(1),
    episode_id: z.string().min(1).nullable().optional(),
    page_id: z.string().min(1).nullable().optional(),
    panel_id: z.string().min(1).nullable().optional(),
    bubble_id: z.string().min(1).nullable().optional(),
}).strict();

export const PackDraftCreateInputSchema = z.object({
    type: PackTypeSchema,
    title: z.string().min(1).max(200),
    language: z.string().max(16).optional(),
    target_series_id: z.string().min(1).optional(),
    target_episode_id: z.string().min(1).optional(),
    version: z.number().int().positive().optional(),
    created_by: z.string().max(120).nullable().optional(),
}).strict();

export const PackDraftStatusUpdateInputSchema = z.object({
    status: PackDraftStatusSchema,
}).strict();

export const PackDraftAdoptProposalInputSchema = z.object({
    proposal_id: z.string().min(1),
}).strict();

export const PackDraftExportInputSchema = z.object({
    pack_id: z.string().min(1).max(120),
    pack_class: PackClassSchema.optional(),
    title: z.string().min(1).max(200).optional(),
    author_label: z.string().max(120).optional(),
    is_published: z.boolean().optional(),
    overwrite: z.boolean().optional(),
}).strict();

export type PackDraftCreateInputData = z.infer<typeof PackDraftCreateInputSchema>;
export type PackDraftStatusUpdateInputData = z.infer<typeof PackDraftStatusUpdateInputSchema>;
export type PackDraftAdoptProposalInputData = z.infer<typeof PackDraftAdoptProposalInputSchema>;
export type PackDraftExportInputData = z.infer<typeof PackDraftExportInputSchema>;
