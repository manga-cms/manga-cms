/**
 * @manga/domain — Shared domain types for the Manga Infrastructure.
 *
 * These types represent the canonical content hierarchy:
 *   Series → Episode → Page → Panel → Bubble
 *
 * Source of truth: docs/api-contract.md, docs/architecture/layer-boundary.md,
 * packages/schemas/src/content.ts, and packages/db/prisma/schema.prisma.
 *
 * Used by:
 *   - apps/viewer (public reader)
 *   - apps/cms (admin SPA)
 *   - apps/api (Hono API)
 */

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    imageId?: string;
    coordinateSpace?: CoordinateSpace;
}

// ---------------------------------------------------------------------------
// Content hierarchy
// ---------------------------------------------------------------------------

export type BubbleType = "speech" | "thought" | "narration" | "sfx" | "caption" | "other";
export type TextDirection = "horizontal" | "vertical";
export type SpeakerConfidence = "confirmed" | "inferred" | "unknown";
export type ContentEntityStatus = "active" | "deprecated" | "deleted" | "merged";
export type CoordinateSpace = "pixel";

export interface ContentFlags {
    shareable: boolean;
    feedback_enabled: boolean;
    contains_spoiler?: boolean;
}

// `clip` is reserved for future multi-Panel share work. MVP public share
// resolvers should expose Episode, Page, Panel, and Bubble only.
export type ShareTargetKind = "episode" | "page" | "panel" | "bubble" | "clip";
export type OgpTargetKind = "page" | "panel" | "bubble" | "clip";

export interface LocalizedContentMetadata {
    title?: string;
    description?: string;
    shareTitle?: string;
    shareDescription?: string;
    /** Localized author/creator display label for public cards and share metadata. */
    authorLabel?: string;
}

export interface PublicImageReference {
    path?: string;
    url?: string;
    imageId?: string;
    contentHash?: string;
    revisionId?: string;
    alt?: string;
    width?: number;
    height?: number;
    mimeType?: string;
}

export interface CreatorCredit {
    /** Free-form role label for MVP; normalize roles only after CMS needs it. */
    role?: string;
    displayName: string;
    localizedDisplayNames?: Record<string, string>;
    url?: string;
    sortOrder?: number;
}

export interface ContentSharePolicyMetadata {
    allowedTargets?: ShareTargetKind[];
}

export interface ContentOgpPolicyMetadata {
    allowedTargets?: OgpTargetKind[];
    allowCrop?: boolean;
    stylePreset?: string;
}

export interface ContentPublicSafetyMetadata {
    rightsClearedForPreview?: boolean;
    hidden?: boolean;
    archived?: boolean;
}

export interface ContentPublicMetadata {
    /** Publish-generated hint. CMS editors should not hand-edit cache keys. */
    revisionId?: string;
    /** Publish-generated hint. Final source of truth belongs to manifest/artifacts. */
    publishedRevisionId?: string;
    /** Publish-generated hint. Final source of truth belongs to manifest/artifacts. */
    contentHash?: string;
    /** Publish-generated hint for public share metadata. */
    publishedAt?: string;
    canonicalLocale?: string;
    availableLocales?: string[];
    defaultReaderLocale?: string;
    /** MVP single-line creator display label. Prefer localized authorLabel when available. */
    authorLabel?: string;
    /** Future-ready creator credits; use authorLabel for MVP display when present. */
    creatorCredits?: CreatorCredit[];
    localized?: Record<string, LocalizedContentMetadata>;
    pageImages?: Record<string, PublicImageReference>;
    coverImage?: PublicImageReference;
    shareImage?: PublicImageReference;
    shareImageAlt?: string;
    sharePolicy?: ContentSharePolicyMetadata;
    ogpPolicy?: ContentOgpPolicyMetadata;
    publicSafety?: ContentPublicSafetyMetadata;
}

export interface BubbleTextLayout {
    lines?: string[];
    inlineAlign?: "start" | "center" | "end";
    blockAlign?: "start" | "center" | "end";
    source?: "manual" | "imported" | "ocr";
}

export interface BubbleTextStyle {
    fontSizePx?: number;
    fontWeight?: number;
    lineHeight?: number;
    letterSpacing?: number;
    fitMode?: "auto" | "shrink" | "fixed";
}

export interface Bubble {
    bubbleId: string;
    /** @deprecated Use bubbleId for canonical content v2. */
    id: string;
    panelId: string | null;
    stableRef: string;
    displayRef?: string;
    status?: ContentEntityStatus;
    bubbleNumber: number;
    /** @deprecated Use displayRef for human-facing refs in canonical content v2. */
    shortId?: string;
    bubbleType: BubbleType;
    textOriginal: string;
    speaker?: string;
    speakerConfidence?: SpeakerConfidence;
    textDirection?: TextDirection;
    lang?: string;
    flags?: ContentFlags;
    metadata?: ContentPublicMetadata;
    textLayout?: BubbleTextLayout;
    textStyle?: BubbleTextStyle;
    bbox: BoundingBox;
}

export interface Panel {
    panelId: string;
    /** @deprecated Use panelId for canonical content v2. */
    id: string;
    stableRef: string;
    displayRef?: string;
    status?: ContentEntityStatus;
    panelNumber: number;
    bbox: BoundingBox;
    reactionTags: string[];
    flags?: ContentFlags;
    metadata?: ContentPublicMetadata;
}

/**
 * Page images are keyed by locale.
 * In the delivery model, these are NOT raw origin URLs — they are
 * tokenized delivery URLs generated by the API at request time.
 * Canonical content stores source image references by locale; Reader and OGP
 * selection should prefer the requested locale key, then canonical locale.
 */
export interface PageImageSet {
    ja?: string;
    en?: string;
    [locale: string]: string | undefined;
}

export interface Page {
    schemaVersion?: 2;
    pageId: string;
    /** @deprecated Use pageId for canonical content v2. */
    id: string;
    stableRef: string;
    pageNumber: number;
    images: PageImageSet;
    imageId?: string;
    imageHash?: string;
    coordinateSpace?: CoordinateSpace;
    width: number;
    height: number;
    displayRef?: string;
    status?: ContentEntityStatus;
    flags?: ContentFlags;
    metadata?: ContentPublicMetadata;
    panels: Panel[];
    bubbles: Bubble[];
}

export interface Episode {
    schemaVersion?: 2;
    editionId?: string;
    revisionId?: string;
    id: string;
    episodeNumber: number;
    title: string;
    publishedAt: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    purchaseUrl?: string;
    redeemUrl?: string;
    metadata?: ContentPublicMetadata;
    pages: Page[];
}

export type SeriesPublicationType = "serial" | "oneshot";
export type SeriesLifecycleStatus = "ongoing" | "completed" | "hiatus";
/** @deprecated Use lifecycleStatus. */
export type SeriesStatus = SeriesLifecycleStatus;
export type PublicationVisibility = "public" | "hidden" | "archived";

export interface Series {
    id: string;
    title: string;
    description: string;
    publicationType: SeriesPublicationType;
    lifecycleStatus: SeriesLifecycleStatus;
    /** @deprecated Use lifecycleStatus. */
    status: SeriesStatus;
    coverUrl: string;
    shareImageUrl?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    metadata?: ContentPublicMetadata;
    episodes: Episode[];
}

// ---------------------------------------------------------------------------
// Shareable units
// ---------------------------------------------------------------------------

/** A reference to a single bubble for quote sharing. */
export interface QuoteRef {
    seriesId: string;
    episodeId: string;
    pageNumber: number;
    panelNumber: number;
    bubbleNumber: number;
}

/** A reference to a panel range for clip sharing. */
export interface ClipRef {
    seriesId: string;
    episodeId: string;
    pageNumber: number;
    panelStart: number;
    panelEnd: number;
}

// ---------------------------------------------------------------------------
// Entitlement primitives
// ---------------------------------------------------------------------------

export type EntitlementTargetType =
    | "SERIES"
    | "EPISODE"
    | "VOLUME"
    | "PACK"
    | "BUNDLE";

export type EntitlementSource =
    | "PURCHASE"
    | "CONTRIBUTOR_REWARD"
    | "PROMO"
    | "ADMIN_GRANT"
    | "SUBSCRIPTION";

export type EntitlementStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

// ---------------------------------------------------------------------------
// Pack
// ---------------------------------------------------------------------------

export type PackType =
    | "TRANSLATION"
    | "FOOTNOTE"
    | "COMMENTARY"
    | "LEARNING"
    | "ACCESSIBILITY";

export type PackClass = "proposal" | "draft" | "official" | "deprecated";

export interface PackEntryTarget {
    seriesId: string;
    episodeId?: string;
    pageId?: string;
    panelId?: string;
    bubbleId?: string;
}

export interface PackEntry {
    id: string;
    target: PackEntryTarget;
    language?: string;
    originalText?: string;
    text?: string;
    note?: string;
    sourceProposalId?: string;
    metadata?: Record<string, unknown>;
    textLayout?: BubbleTextLayout;
    textStyle?: BubbleTextStyle;
}

export interface PackSummary {
    id: string;
    type: PackType;
    packClass?: PackClass;
    language?: string;
    version: number;
    title?: string;
    authorLabel?: string;
    isPublished: boolean;
}

export interface PackManifest extends PackSummary {
    targetSeriesId?: string;
    targetEpisodeId?: string;
    sourcePackDraftId?: string;
    entries: PackEntry[];
}

export type PublishedPackEntry = Omit<PackEntry, "sourceProposalId" | "metadata">;

export interface PublishedPack extends Omit<PackManifest, "sourcePackDraftId" | "entries" | "isPublished"> {
    isPublished: true;
    entries: PublishedPackEntry[];
}

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

/** Supported locales. Extensible — add new locales as translations arrive. */
export type SupportedLocale = "ja" | "en";

export const DEFAULT_LOCALE: SupportedLocale = "ja";
