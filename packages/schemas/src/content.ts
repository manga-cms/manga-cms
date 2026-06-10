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

export const CoordinateSpaceSchema = z.literal("pixel");

export const BoundingBoxSchema = z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().positive(),
    height: z.number().positive(),
    imageId: z.string().min(1).optional(),
    coordinateSpace: CoordinateSpaceSchema.optional(),
});

// ---------------------------------------------------------------------------
// Content hierarchy
// ---------------------------------------------------------------------------

export const BubbleTypeSchema = z.enum(["speech", "thought", "narration", "sfx", "caption", "other"]);
export const TextDirectionSchema = z.enum(["horizontal", "vertical"]);
export const SpeakerConfidenceSchema = z.enum(["confirmed", "inferred", "unknown"]);
export const ContentEntityStatusSchema = z.enum(["active", "deprecated", "deleted", "merged"]);

export const ContentFlagsSchema = z.object({
    shareable: z.boolean().default(true),
    feedback_enabled: z.boolean().default(true),
    contains_spoiler: z.boolean().optional(),
});

const PublishDateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a parseable date-time",
});

const PublicUrlSchema = z.string().refine(
    (value) => value.startsWith("/") || /^https?:\/\//.test(value),
    { message: "Must be a root-relative or http(s) URL" },
);

export const ShareTargetKindSchema = z.enum(["episode", "page", "panel", "bubble", "clip"]);
export const OgpTargetKindSchema = z.enum(["page", "panel", "bubble", "clip"]);

export const LocalizedContentMetadataSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    shareTitle: z.string().optional(),
    shareDescription: z.string().optional(),
    authorLabel: z.string().optional(),
});

export const PublicImageReferenceSchema = z.object({
    path: z.string().min(1).optional(),
    url: PublicUrlSchema.optional(),
    imageId: z.string().min(1).optional(),
    contentHash: z.string().min(1).optional(),
    revisionId: z.string().min(1).optional(),
    alt: z.string().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    mimeType: z.string().min(1).optional(),
});

export const CreatorCreditSchema = z.object({
    role: z.string().min(1).optional(),
    displayName: z.string().min(1),
    localizedDisplayNames: z.record(z.string(), z.string()).optional(),
    url: PublicUrlSchema.optional(),
    sortOrder: z.number().int().nonnegative().optional(),
});

export const ContentSharePolicyMetadataSchema = z.object({
    allowedTargets: z.array(ShareTargetKindSchema).optional(),
});

export const ContentOgpPolicyMetadataSchema = z.object({
    allowedTargets: z.array(OgpTargetKindSchema).optional(),
    allowCrop: z.boolean().optional(),
    stylePreset: z.string().min(1).optional(),
});

export const ContentPublicSafetyMetadataSchema = z.object({
    rightsClearedForPreview: z.boolean().optional(),
    hidden: z.boolean().optional(),
    archived: z.boolean().optional(),
});

export const ContentPublicMetadataSchema = z.object({
    revisionId: z.string().min(1).optional(),
    publishedRevisionId: z.string().min(1).optional(),
    contentHash: z.string().min(1).optional(),
    publishedAt: PublishDateTimeSchema.optional(),
    canonicalLocale: z.string().min(1).optional(),
    availableLocales: z.array(z.string().min(1)).optional(),
    defaultReaderLocale: z.string().min(1).optional(),
    authorLabel: z.string().optional(),
    creatorCredits: z.array(CreatorCreditSchema).optional(),
    localized: z.record(z.string(), LocalizedContentMetadataSchema).optional(),
    pageImages: z.record(z.string(), PublicImageReferenceSchema).optional(),
    coverImage: PublicImageReferenceSchema.optional(),
    shareImage: PublicImageReferenceSchema.optional(),
    shareImageAlt: z.string().optional(),
    sharePolicy: ContentSharePolicyMetadataSchema.optional(),
    ogpPolicy: ContentOgpPolicyMetadataSchema.optional(),
    publicSafety: ContentPublicSafetyMetadataSchema.optional(),
});

const BubbleInputSchema = z.object({
    bubbleId: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    stableRef: z.string().min(1).optional(),
    displayRef: z.string().min(1).optional(),
    status: ContentEntityStatusSchema.default("active").optional(),
    panelId: z.string().min(1).nullable(),
    bubbleNumber: z.number().int().positive(),
    shortId: z.string().optional(),
    bubbleType: BubbleTypeSchema,
    textOriginal: z.string(),
    speaker: z.string().optional(),
    speakerConfidence: SpeakerConfidenceSchema.optional(),
    textDirection: TextDirectionSchema.optional(),
    lang: z.string().optional(),
    flags: ContentFlagsSchema.optional(),
    metadata: ContentPublicMetadataSchema.optional(),
    bbox: BoundingBoxSchema,
});

export const BubbleSchema = BubbleInputSchema.superRefine((value, ctx) => {
    const bubbleId = value.bubbleId ?? value.id;
    if (!bubbleId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bubbleId"],
            message: "bubbleId is required",
        });
    }
}).transform((value) => {
    const bubbleId = value.bubbleId ?? value.id ?? "";
    const displayRef = value.displayRef ?? value.shortId;
    return {
        ...value,
        bubbleId,
        id: value.id ?? bubbleId,
        stableRef: value.stableRef ?? bubbleId,
        ...(displayRef !== undefined && { displayRef }),
        ...(value.shortId !== undefined && { shortId: value.shortId }),
    };
});

const LegacyNestedBubbleSchema = BubbleInputSchema.omit({ panelId: true }).extend({
    panelId: z.string().min(1).nullable().optional(),
}).superRefine((value, ctx) => {
    const bubbleId = value.bubbleId ?? value.id;
    if (!bubbleId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bubbleId"],
            message: "bubbleId is required",
        });
    }
}).transform((value) => {
    const bubbleId = value.bubbleId ?? value.id ?? "";
    const displayRef = value.displayRef ?? value.shortId;
    return {
        ...value,
        bubbleId,
        id: value.id ?? bubbleId,
        stableRef: value.stableRef ?? bubbleId,
        ...(displayRef !== undefined && { displayRef }),
        ...(value.shortId !== undefined && { shortId: value.shortId }),
    };
});

const PanelInputSchema = z.object({
    panelId: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    stableRef: z.string().min(1).optional(),
    displayRef: z.string().min(1).optional(),
    status: ContentEntityStatusSchema.default("active").optional(),
    panelNumber: z.number().int().positive(),
    bbox: BoundingBoxSchema,
    reactionTags: z.array(z.string()).default([]),
    flags: ContentFlagsSchema.optional(),
    metadata: ContentPublicMetadataSchema.optional(),
    bubbles: z.array(LegacyNestedBubbleSchema).default([]),
}).superRefine((value, ctx) => {
    const panelId = value.panelId ?? value.id;
    if (!panelId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["panelId"],
            message: "panelId is required",
        });
    }
});

export const PanelSchema = PanelInputSchema.transform((value) => {
    const panelId = value.panelId ?? value.id ?? "";
    const { bubbles: _legacyBubbles, ...panel } = value;
    return {
        ...panel,
        panelId,
        id: value.id ?? panelId,
        stableRef: value.stableRef ?? panelId,
    };
});

export const PageImageSetSchema = z.record(z.string(), z.string()).default({});

export const PageSchema = z.object({
    schemaVersion: z.literal(2).default(2).optional(),
    pageId: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    stableRef: z.string().min(1).optional(),
    pageNumber: z.number().int().positive(),
    images: PageImageSetSchema,
    imageId: z.string().min(1).optional(),
    imageHash: z.string().min(1).optional(),
    coordinateSpace: CoordinateSpaceSchema.default("pixel").optional(),
    width: z.number().positive(),
    height: z.number().positive(),
    displayRef: z.string().optional(),
    status: ContentEntityStatusSchema.default("active").optional(),
    flags: ContentFlagsSchema.optional(),
    metadata: ContentPublicMetadataSchema.optional(),
    panels: z.array(PanelInputSchema).default([]),
    bubbles: z.array(BubbleSchema).default([]),
}).superRefine((value, ctx) => {
    const pageId = value.pageId ?? value.id;
    if (!pageId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["pageId"],
            message: "pageId is required",
        });
    }
}).transform((value) => {
    const pageId = value.pageId ?? value.id ?? "";
    const panels = value.panels.map((panel) => PanelSchema.parse(panel));
    const legacyBubbles = value.panels.flatMap((panel) => {
        const panelId = panel.panelId ?? panel.id ?? "";
        return (panel.bubbles ?? []).map((bubble) => BubbleSchema.parse({
            ...bubble,
            panelId: bubble.panelId ?? panelId,
        }));
    });
    const bubbleById = new Map<string, z.infer<typeof BubbleSchema>>();
    for (const bubble of [...value.bubbles, ...legacyBubbles]) {
        bubbleById.set(bubble.bubbleId, bubble);
    }
    const bubbles = [...bubbleById.values()].map((bubble, index) => ({
        ...bubble,
        bubbleNumber: index + 1,
    }));
    return {
        ...value,
        schemaVersion: value.schemaVersion ?? 2,
        pageId,
        id: value.id ?? pageId,
        stableRef: value.stableRef ?? pageId,
        coordinateSpace: value.coordinateSpace ?? "pixel",
        panels,
        bubbles,
    };
});

export interface ContentLintWarning {
    code: string;
    severity: "warning" | "error";
    path: Array<string | number>;
    message: string;
    pageId?: string;
    panelId?: string;
    bubbleId?: string;
    source?: "schema" | "content-lint" | "ingestion" | "cms";
}

export function lintPageContent(page: PageData): ContentLintWarning[] {
    const warnings: ContentLintWarning[] = [];
    const panelsById = new Map(page.panels.map((panel) => [panel.panelId, panel]));

    for (let i = 0; i < page.bubbles.length; i++) {
        const bubble = page.bubbles[i];
        if (bubble.panelId && !panelsById.has(bubble.panelId)) {
            warnings.push({
                severity: "error",
                code: "INVALID_PANEL_REF",
                message: `Bubble ${bubble.bubbleId} references non-existent panel ${bubble.panelId}`,
                path: ["bubbles", i, "panelId"],
                pageId: page.pageId,
                panelId: bubble.panelId,
                bubbleId: bubble.bubbleId,
                source: "content-lint",
            });
        }
    }

    const checkPageBounds = (
        bbox: { x: number; y: number; width: number; height: number },
        pathPrefix: Array<string | number>,
        name: string,
        ids: Pick<ContentLintWarning, "panelId" | "bubbleId">,
    ) => {
        const tolerance = 2;
        if (bbox.x < -tolerance || bbox.y < -tolerance ||
            (bbox.x + bbox.width) > page.width + tolerance ||
            (bbox.y + bbox.height) > page.height + tolerance) {
            warnings.push({
                severity: "warning",
                code: "BBOX_OUT_OF_BOUNDS",
                message: `${name} bounding box exceeds page dimensions (${page.width}x${page.height}). This may be intentional for bleeding panels.`,
                path: [...pathPrefix, "bbox"],
                pageId: page.pageId,
                ...ids,
                source: "content-lint",
            });
        }
    };

    const contains = (
        outer: { x: number; y: number; width: number; height: number },
        inner: { x: number; y: number; width: number; height: number },
    ) => {
        const tolerance = 2;
        return inner.x >= outer.x - tolerance &&
            inner.y >= outer.y - tolerance &&
            inner.x + inner.width <= outer.x + outer.width + tolerance &&
            inner.y + inner.height <= outer.y + outer.height + tolerance;
    };

    page.panels.forEach((panel, i) => {
        checkPageBounds(panel.bbox, ["panels", i], `Panel ${panel.panelId}`, {
            panelId: panel.panelId,
        });
    });

    page.bubbles.forEach((bubble, i) => {
        checkPageBounds(bubble.bbox, ["bubbles", i], `Bubble ${bubble.bubbleId}`, {
            panelId: bubble.panelId ?? undefined,
            bubbleId: bubble.bubbleId,
        });

        if (!bubble.panelId) return;
        const panel = panelsById.get(bubble.panelId);
        if (!panel || contains(panel.bbox, bubble.bbox)) return;

        warnings.push({
            severity: "warning",
            code: "BUBBLE_OUTSIDE_PANEL_BBOX",
            message: `Bubble ${bubble.bubbleId} is linked to panel ${bubble.panelId} but its bbox is not contained by the panel bbox.`,
            path: ["bubbles", i, "bbox"],
            pageId: page.pageId,
            panelId: bubble.panelId,
            bubbleId: bubble.bubbleId,
            source: "content-lint",
        });
    });

    return warnings;
}

function validatePublishWindow(
    value: { publishStartAt?: string; publishEndAt?: string },
    ctx: z.RefinementCtx,
): void {
    if (!value.publishStartAt || !value.publishEndAt) return;
    if (Date.parse(value.publishEndAt) <= Date.parse(value.publishStartAt)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["publishEndAt"],
            message: "publishEndAt must be after publishStartAt",
        });
    }
}

export const EpisodeSchema = z.object({
    schemaVersion: z.literal(2).default(2).optional(),
    editionId: z.string().min(1).optional(),
    revisionId: z.string().min(1).optional(),
    id: z.string().min(1),
    episodeNumber: z.number().int().positive(),
    title: z.string(),
    publishedAt: z.string(),
    publishStartAt: PublishDateTimeSchema.optional(),
    publishEndAt: PublishDateTimeSchema.optional(),
    visibility: z.enum(["public", "hidden", "archived"]).default("public").optional(),
    purchaseUrl: PublicUrlSchema.optional(),
    redeemUrl: PublicUrlSchema.optional(),
    metadata: ContentPublicMetadataSchema.optional(),
    pages: z.array(PageSchema).default([]),
}).superRefine(validatePublishWindow);

export const SeriesPublicationTypeSchema = z.enum(["serial", "oneshot"]);
export const SeriesLifecycleStatusSchema = z.enum(["ongoing", "completed", "hiatus"]);
/** @deprecated Use SeriesLifecycleStatusSchema. */
export const SeriesStatusSchema = SeriesLifecycleStatusSchema;
export const PublicationVisibilitySchema = z.enum(["public", "hidden", "archived"]);
export const PublicImageUrlSchema = PublicUrlSchema;

/** Schema for `contents/{seriesId}/series.json` */
export const SeriesManifestSchema = z.object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().default(""),
    publicationType: SeriesPublicationTypeSchema.default("serial").optional(),
    lifecycleStatus: SeriesLifecycleStatusSchema.optional(),
    status: SeriesStatusSchema.default("ongoing"),
    cover: z.string().default("cover.jpg"),
    shareImageUrl: PublicImageUrlSchema.optional(),
    publishStartAt: PublishDateTimeSchema.optional(),
    publishEndAt: PublishDateTimeSchema.optional(),
    visibility: PublicationVisibilitySchema.default("public").optional(),
    metadata: ContentPublicMetadataSchema.optional(),
    episodes: z.array(z.string()).default([]),
}).superRefine(validatePublishWindow);

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

export const PackClassSchema = z.enum(["proposal", "draft", "official", "deprecated"]);

export const PackEntryTargetSchema = z.object({
    seriesId: z.string().min(1),
    episodeId: z.string().min(1).optional(),
    pageId: z.string().min(1).optional(),
    panelId: z.string().min(1).optional(),
    bubbleId: z.string().min(1).optional(),
});

export const PackEntrySchema = z.object({
    id: z.string().min(1),
    target: PackEntryTargetSchema,
    language: z.string().optional(),
    originalText: z.string().optional(),
    text: z.string().optional(),
    note: z.string().optional(),
    sourceProposalId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const PackManifestSchema = z.object({
    id: z.string().min(1),
    type: PackTypeSchema,
    packClass: PackClassSchema.default("draft").optional(),
    language: z.string().optional(),
    version: z.number().int().positive().default(1),
    title: z.string().optional(),
    authorLabel: z.string().optional(),
    isPublished: z.boolean().default(false),
    targetSeriesId: z.string().optional(),
    targetEpisodeId: z.string().optional(),
    sourcePackDraftId: z.string().optional(),
    entries: z.array(PackEntrySchema).default([]),
});

export const PublishedPackEntrySchema = PackEntrySchema.omit({
    sourceProposalId: true,
    metadata: true,
});

export const PublishedPackSchema = PackManifestSchema.omit({
    sourcePackDraftId: true,
    entries: true,
}).extend({
    isPublished: z.literal(true),
    entries: z.array(PublishedPackEntrySchema).default([]),
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
export type PublishedPack = z.infer<typeof PublishedPackSchema>;
