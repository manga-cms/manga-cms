import { z } from "zod";

export const BoundingBoxSchema = z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
}).strict();

export const ArtifactMetadataSchema = z.object({
    artifact_version: z.string().min(1),
    provider: z.string().min(1),
    model: z.string().min(1),
    created_at: z.string().datetime(),
    prompt_version: z.string().min(1).optional(),
    run_id: z.string().min(1).optional(),
    finished_at: z.string().datetime().optional(),
    temperature: z.number().optional(),
    latency_ms: z.number().nonnegative().optional(),
}).strict();

const ArtifactSourceSchema = z.enum([
    "page_image",
    "csp_text_export",
    "clip_text_export",
    "psd_text_layer",
    "psd_text_export",
    "ocr",
    "manual",
]);

const BubbleClassificationSchema = z.enum([
    "speech",
    "thought",
    "narration",
    "sfx",
    "caption",
    "other",
    "unknown",
]);

export const RegionArtifactSchema = z.object({
    artifact_id: z.string().min(1),
    artifact_type: z.literal("region"),
    page_id: z.string().min(1),
    region_kind: z.enum(["panel", "bubble", "text_region"]),
    bbox: BoundingBoxSchema,
    confidence: z.number().min(0).max(1),
    source: ArtifactSourceSchema,
    metadata: ArtifactMetadataSchema,
    classification: BubbleClassificationSchema.optional(),
    parent_artifact_id: z.string().min(1).optional(),
}).strict();

export const AlignmentArtifactSchema = z.object({
    artifact_id: z.string().min(1),
    artifact_type: z.literal("alignment"),
    page_id: z.string().min(1),
    bbox: BoundingBoxSchema,
    confidence: z.number().min(0).max(1),
    source: ArtifactSourceSchema,
    metadata: ArtifactMetadataSchema,
    bubble_candidate_id: z.string().min(1),
    panel_candidate_id: z.string().min(1).optional(),
    selected_text: z.string(),
    ocr_text: z.string().optional(),
    source_text: z.string().optional(),
    source_record_id: z.string().min(1).optional(),
    classification: BubbleClassificationSchema,
}).strict();

export const OCRArtifactSchema = z.object({
    artifact_id: z.string().min(1),
    artifact_type: z.literal("ocr"),
    page_id: z.string().min(1),
    bbox: BoundingBoxSchema,
    confidence: z.number().min(0).max(1),
    source: ArtifactSourceSchema,
    metadata: ArtifactMetadataSchema,
    text: z.string(),
    language: z.string().min(1).optional(),
}).strict();

// Backward-compatible aliases used by the PoC package internals.
export const boundingBoxSchema = BoundingBoxSchema;
export const regionCandidateSchema = RegionArtifactSchema;
export const textAlignmentCandidateSchema = AlignmentArtifactSchema;
