import { z } from "zod";
import { BoundingBoxSchema } from "./artifact-schema.js";

export const BubbleDraftSchema = z.object({
    bubbleNumber: z.number().int().positive(),
    bubbleType: z.enum(["speech", "thought", "narration", "sfx"]),
    textOriginal: z.string(),
    speaker: z.string().optional(),
}).strict();

export const PanelDraftSchema = z.object({
    panelNumber: z.number().int().positive(),
    bbox: BoundingBoxSchema,
    reactionTags: z.array(z.string()),
    bubbles: z.array(BubbleDraftSchema),
}).strict();

export const PageDraftSchema = z.object({
    pageNumber: z.number().int().positive(),
    imagePath: z.string().min(1),
    sourceImagePath: z.string().min(1).optional(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    displayRef: z.string().min(1).optional(),
    panels: z.array(PanelDraftSchema),
}).strict();

export const CanonicalDraftPayloadSchema = z.object({
    seriesId: z.string().min(1),
    seriesTitle: z.string().min(1),
    seriesDescription: z.string().optional(),
    seriesStatus: z.enum(["ongoing", "completed", "hiatus"]).optional(),
    episodeId: z.string().min(1),
    episodeNumber: z.number().int().positive(),
    episodeTitle: z.string().min(1),
    pages: z.array(PageDraftSchema),
}).strict();

// Backward-compatible alias used by the PoC package internals.
export const canonicalDraftSchema = CanonicalDraftPayloadSchema;
