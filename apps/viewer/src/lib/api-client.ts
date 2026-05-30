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
    series: { id: string; title: string; coverUrl?: string; shareImageUrl?: string };
    episode: {
        id: string;
        episodeNumber: number;
        title: string;
        publishedAt: string;
        pages: {
            id: string;
            pageNumber: number;
            images: Record<string, string | undefined>;
            width: number;
            height: number;
            panels: {
                id: string;
                panelNumber: number;
                bbox: { x: number; y: number; width: number; height: number };
                reactionTags: string[];
                bubbles: {
                    id: string;
                    shortId: string;
                    bubbleNumber: number;
                    bubbleType: string;
                    bbox: { x: number; y: number; width: number; height: number };
                    textOriginal: string;
                    speaker: string | null;
                }[];
            }[];
        }[];
    };
    prev: { id: string; title: string; episodeNumber: number } | null;
    next: { id: string; title: string; episodeNumber: number } | null;
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
        shortId: string;
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
