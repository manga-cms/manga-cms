/**
 * API client for the manga viewer.
 *
 * SSR pages use this module to fetch data from @manga/api at request time.
 * This is the primary data path for SSR pages — it enables entitlement gating,
 * personalized delivery URLs, and per-request content resolution.
 *
 * Fallback: if API_BASE is not set, functions fall back to the shared
 * FileContentRepository (same as build-time pages). This allows development
 * without running the API server, but means no entitlement/delivery features.
 *
 * Set API_BASE in your environment:
 *   API_BASE=http://localhost:3000/api/v1
 */

const API_BASE = (typeof process !== "undefined" && process.env?.API_BASE) || "";

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, cookies?: string | null): Promise<{ data: T | null; error: string | null }> {
    if (!API_BASE) return { data: null, error: "API_BASE not configured" };

    try {
        const headers: Record<string, string> = {};
        if (cookies) headers["Cookie"] = cookies;
        const res = await fetch(`${API_BASE}${path}`, { headers });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg = (body as { error?: { message?: string } })?.error?.message ?? res.statusText;
            return { data: null, error: `${res.status}: ${msg}` };
        }
        const data = (await res.json()) as T;
        return { data, error: null };
    } catch (e) {
        return { data: null, error: `API fetch failed: ${(e as Error).message}` };
    }
}

// ---------------------------------------------------------------------------
// Response types (aligned with openapi.yaml / API output)
// ---------------------------------------------------------------------------

export interface EpisodeMetaResponse {
    availablePacks?: PublishedPack[];
    series: {
        id: string;
        title: string;
        description?: string;
        publicationType?: "serial" | "oneshot";
        lifecycleStatus?: "ongoing" | "completed" | "hiatus";
        coverUrl?: string;
        shareImageUrl?: string;
        metadata?: Record<string, unknown>;
    };
    episode: {
        id: string;
        episodeNumber: number;
        title: string;
        description?: string;
        publicationType?: "serial" | "oneshot";
        metadata?: Record<string, unknown>;
        publishedAt: string;
        purchaseUrl?: string;
        redeemUrl?: string;
        pages: {
            pageId?: string;
            id: string;
            stableRef?: string;
            pageNumber: number;
            images: Record<string, string | undefined>;
            imageId?: string;
            metadata?: Record<string, unknown>;
            coordinateSpace?: "pixel";
            width: number;
            height: number;
            availablePacks?: PublishedPack[];
            bubbles?: {
                bubbleId?: string;
                id: string;
                panelId: string | null;
                displayRef?: string;
                shortId?: string;
                bubbleNumber: number;
                bubbleType: string;
                bbox: { x: number; y: number; width: number; height: number };
                textOriginal: string;
                textDirection?: "horizontal" | "vertical";
                lang?: string;
                textLayout?: BubbleTextLayout;
                textStyle?: BubbleTextStyle;
                speaker: string | null;
                metadata?: Record<string, unknown>;
            }[];
            panels: {
                panelId?: string;
                id: string;
                stableRef?: string;
                panelNumber: number;
                bbox: { x: number; y: number; width: number; height: number };
                reactionTags: string[];
                metadata?: Record<string, unknown>;
                bubbles: {
                    bubbleId?: string;
                    id: string;
                    panelId?: string | null;
                    displayRef?: string;
                    shortId?: string;
                    bubbleNumber: number;
                    bubbleType: string;
                    bbox: { x: number; y: number; width: number; height: number };
                    textOriginal: string;
                    textDirection?: "horizontal" | "vertical";
                    lang?: string;
                    textLayout?: BubbleTextLayout;
                    textStyle?: BubbleTextStyle;
                    speaker: string | null;
                    metadata?: Record<string, unknown>;
                }[];
            }[];
        }[];
    };
    prev: { id: string; title: string; episodeNumber: number } | null;
    next: { id: string; title: string; episodeNumber: number } | null;
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

export interface PublicSeriesListItem {
    id: string;
    title: string;
    description: string;
    publicationType?: "serial" | "oneshot";
    lifecycleStatus?: "ongoing" | "completed" | "hiatus";
    status: string;
    coverUrl?: string;
    shareImageUrl?: string;
    visibility?: "public" | "hidden" | "archived";
    episodeCount: number;
}

export interface PublicSeriesDetail extends PublicSeriesListItem {
    episodes: {
        id: string;
        episodeNumber: number;
        title: string;
        publishedAt: string;
        pageCount?: number;
    }[];
}

export interface PublishedPackEntry {
    id: string;
    target: {
        seriesId: string;
        episodeId?: string;
        pageId?: string;
        panelId?: string;
        bubbleId?: string;
    };
    language?: string;
    originalText?: string;
    text?: string;
    note?: string;
    textLayout?: BubbleTextLayout;
    textStyle?: BubbleTextStyle;
}

export interface PublishedPack {
    id: string;
    type: "TRANSLATION" | "FOOTNOTE" | "COMMENTARY" | "LEARNING" | "ACCESSIBILITY";
    packClass?: "proposal" | "draft" | "official" | "deprecated";
    language?: string;
    version: number;
    title?: string;
    authorLabel?: string;
    isPublished: boolean;
    targetSeriesId?: string;
    targetEpisodeId?: string;
    entries: PublishedPackEntry[];
}

export interface QuoteResponse {
    seriesId: string;
    episodeId: string;
    pageId: string;
    panelId: string;
    pageNumber: number;
    panelNumber: number;
    bubble: {
        id: string;
        shortId?: string;
        bubbleNumber: number;
        bubbleType: string;
        textOriginal: string;
        speaker: string | null;
        bbox: { x: number; y: number; width: number; height: number };
    };
    panelPreview: {
        id: string;
        panelNumber: number;
        bbox: { x: number; y: number; width: number; height: number };
    };
}

export interface ClipResponse {
    seriesId: string;
    episodeId: string;
    pageId: string;
    pageNumber: number;
    panelStart: number;
    panelEnd: number;
    panels: {
        id: string;
        panelNumber: number;
        bbox: { x: number; y: number; width: number; height: number };
        reactionTags: string[];
        bubbles: {
            id: string;
            bubbleNumber: number;
            textOriginal: string;
            speaker: string | null;
            bubbleType: string;
        }[];
    }[];
}

export interface ReactionItem {
    seriesId: string;
    seriesTitle: string;
    episodeId: string;
    episodeNumber: number;
    pageNumber: number;
    panel: {
        id: string;
        panelNumber: number;
        bbox: { x: number; y: number; width: number; height: number };
        reactionTags: string[];
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Whether API is configured. SSR pages check this to decide the data path. */
export const isApiConfigured = (): boolean => !!API_BASE;

/** Fetch episode metadata + navigation from API. */
export async function fetchEpisode(
    seriesId: string,
    episodeId: string,
    cookies?: string | null,
): Promise<{ data: EpisodeMetaResponse | null; error: string | null }> {
    return apiFetch<EpisodeMetaResponse>(
        `/series/${seriesId}/episodes/${episodeId}`,
        cookies,
    );
}

/** Fetch public Series list from API. */
export async function fetchSeriesList(): Promise<{ data: { items: PublicSeriesListItem[] } | null; error: string | null }> {
    return apiFetch<{ items: PublicSeriesListItem[] }>("/series");
}

/** Fetch public Series detail from API. */
export async function fetchSeries(
    seriesId: string,
): Promise<{ data: PublicSeriesDetail | null; error: string | null }> {
    return apiFetch<PublicSeriesDetail>(`/series/${encodeURIComponent(seriesId)}`);
}

/** Fetch quote data from API. */
export async function fetchQuote(
    seriesId: string,
    episodeId: string,
    page: number,
    panel: number,
    bubble: number,
): Promise<{ data: QuoteResponse | null; error: string | null }> {
    return apiFetch<QuoteResponse>(
        `/quotes/${seriesId}/${episodeId}/${page}/${panel}/${bubble}`,
    );
}

/** Fetch clip data from API. */
export async function fetchClip(
    seriesId: string,
    episodeId: string,
    page: number,
    panelStart: number,
    panelEnd: number,
): Promise<{ data: ClipResponse | null; error: string | null }> {
    return apiFetch<ClipResponse>(
        `/clips/${seriesId}/${episodeId}/${page}/${panelStart}/${panelEnd}`,
    );
}

/** Fetch reaction panels from API. */
export async function fetchReactions(
    tag: string,
): Promise<{ data: { items: ReactionItem[] } | null; error: string | null }> {
    return apiFetch<{ items: ReactionItem[] }>(
        `/reactions?tag=${encodeURIComponent(tag)}`,
    );
}
