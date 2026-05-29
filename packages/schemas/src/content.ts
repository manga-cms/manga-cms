/**
 * @manga/schemas — Zod schemas for content and pack validation.
 *
 * These schemas validate the JSON files in `contents/` and `packs/`.
 * They are the runtime counterpart of the TypeScript types in @manga/domain.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export const BoundingBoxSchema = z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
});

// ---------------------------------------------------------------------------
// Content hierarchy
// ---------------------------------------------------------------------------

export const BubbleTypeSchema = z.enum(["speech", "thought", "narration", "sfx", "caption", "other"]);
export const TextDirectionSchema = z.enum(["horizontal", "vertical"]);
export const SpeakerConfidenceSchema = z.enum(["confirmed", "inferred", "unknown"]);

export const ContentFlagsSchema = z.object({
    shareable: z.boolean().default(true),
    feedback_enabled: z.boolean().default(true),
    contains_spoiler: z.boolean().optional(),
});

export const BubbleSchema = z.object({
    id: z.string().min(1),
    bubbleNumber: z.number().int().positive(),
    shortId: z.string(),
    bubbleType: BubbleTypeSchema,
    textOriginal: z.string(),
    speaker: z.string().optional(),
    speakerConfidence: SpeakerConfidenceSchema.optional(),
    textDirection: TextDirectionSchema.optional(),
    lang: z.string().optional(),
    flags: ContentFlagsSchema.optional(),
    bbox: BoundingBoxSchema,
});

export const PanelSchema = z.object({
    id: z.string().min(1),
    panelNumber: z.number().int().positive(),
    bbox: BoundingBoxSchema,
    reactionTags: z.array(z.string()).default([]),
    flags: ContentFlagsSchema.optional(),
    bubbles: z.array(BubbleSchema).default([]),
});

export const PageImageSetSchema = z.record(z.string(), z.string()).default({});

export const PageSchema = z.object({
    id: z.string().min(1),
    pageNumber: z.number().int().positive(),
    images: PageImageSetSchema,
    width: z.number().positive(),
    height: z.number().positive(),
    displayRef: z.string().optional(),
    flags: ContentFlagsSchema.optional(),
    panels: z.array(PanelSchema).default([]),
});

export const EpisodeSchema = z.object({
    id: z.string().min(1),
    episodeNumber: z.number().int().positive(),
    title: z.string(),
    publishedAt: z.string(),
    pages: z.array(PageSchema).default([]),
});

export const SeriesStatusSchema = z.enum(["ongoing", "completed", "hiatus"]);

/** Schema for `contents/{seriesId}/series.json` */
export const SeriesManifestSchema = z.object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().default(""),
    status: SeriesStatusSchema.default("ongoing"),
    cover: z.string().default("cover.jpg"),
    episodes: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

export const PackTypeSchema = z.enum([
    "TRANSLATION",
    "FOOTNOTE",
    "COMMENTARY",
    "LEARNING",
    "ACCESSIBILITY",
]);

export const PackManifestSchema = z.object({
    id: z.string().min(1),
    type: PackTypeSchema,
    language: z.string().optional(),
    version: z.number().int().positive().default(1),
    title: z.string().optional(),
    authorLabel: z.string().optional(),
    isPublished: z.boolean().default(false),
    targetSeriesId: z.string().optional(),
    entries: z.array(z.unknown()).default([]),
});

// ---------------------------------------------------------------------------
// Inferred types (use these when you want validated data)
// ---------------------------------------------------------------------------

export type SeriesManifest = z.infer<typeof SeriesManifestSchema>;
export type EpisodeData = z.infer<typeof EpisodeSchema>;
export type PageData = z.infer<typeof PageSchema>;
export type PanelData = z.infer<typeof PanelSchema>;
export type BubbleData = z.infer<typeof BubbleSchema>;
export type PackManifest = z.infer<typeof PackManifestSchema>;
