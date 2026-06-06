import { z } from "zod";
import { BoundingBoxSchema, BubbleTypeSchema, SpeakerConfidenceSchema, TextDirectionSchema } from "./content.js";

export const ImportedBubbleSourceSchema = z.literal("psd_text_layer");

export const ImportDetectionMetadataSchema = z.object({
    ocrConfidence: z.number().min(0).max(1).optional(),
    detectionConfidence: z.number().min(0).max(1).optional(),
    textCenter: z.object({
        x: z.number(),
        y: z.number(),
    }).strict().optional(),
    detectorRunId: z.string().min(1).optional(),
    sourceDetector: z.string().min(1).optional(),
    sourceArtifactIds: z.array(z.string().min(1)).optional(),
}).strict();

export const ImportedBubbleDraftSchema = z.object({
    stableRef: z.string().min(1),
    source: ImportedBubbleSourceSchema,
    textOriginal: z.string(),
    layerName: z.string(),
    groupPath: z.array(z.string()),
    visible: z.boolean(),
    bbox: BoundingBoxSchema.optional(),
    bubbleType: BubbleTypeSchema.optional(),
    speaker: z.string().optional(),
    speakerConfidence: SpeakerConfidenceSchema.optional(),
    textDirection: TextDirectionSchema.optional(),
    lang: z.string().optional(),
    sourceLayerId: z.string().min(1).optional(),
    detectionMetadata: ImportDetectionMetadataSchema.optional(),
    notes: z.array(z.string()).optional(),
}).strict();

export const PageImportResultSchema = z.object({
    sourceFile: z.string().min(1),
    parser: z.string().min(1),
    parserVersion: z.string().optional(),
    pageNumber: z.number().int().positive().optional(),
    displayRef: z.string().min(1).optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    detectionMetadata: ImportDetectionMetadataSchema.optional(),
    bubbles: z.array(ImportedBubbleDraftSchema),
    warnings: z.array(z.string()),
    unsupported: z.array(z.string()),
}).strict();

export type ImportDetectionMetadataData = z.infer<typeof ImportDetectionMetadataSchema>;
export type ImportedBubbleDraftData = z.infer<typeof ImportedBubbleDraftSchema>;
export type PageImportResultData = z.infer<typeof PageImportResultSchema>;
