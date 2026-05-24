/**
 * Content data layer for the manga viewer.
 *
 * This module provides build-time data access via FileContentRepository.
 * It reads `contents/` JSON files (validated by Zod schemas) and is used by
 * prerendered pages (home, works index, work detail).
 *
 * SSR pages should use the API client (src/lib/api-client.ts) as the primary
 * data source and fall back to this module only when API_BASE is not configured.
 */

import { join } from "node:path";
import {
    createFileRepository,
    type ContentRepository,
} from "@manga/domain";

// ---------------------------------------------------------------------------
// Repository singleton — reads contents/ on disk
// ---------------------------------------------------------------------------

const CONTENTS_DIR =
    typeof import.meta.dirname === "string"
        ? join(import.meta.dirname, "../../../../contents")
        : join(process.cwd(), "contents");

const repo: ContentRepository = createFileRepository(CONTENTS_DIR);

// Re-export the repository methods for use by prerendered pages
export const listSeries = () => repo.listSeries();
export const getSeries = (id: string) => repo.getSeries(id);
export const getEpisode = (seriesId: string, episodeId: string) =>
    repo.getEpisode(seriesId, episodeId);
export const getAdjacentEpisodes = (seriesId: string, episodeId: string) =>
    repo.getAdjacentEpisodes(seriesId, episodeId);
export const findBubbleBySlug = (slug: string[]) => {
    if (slug.length < 5) return undefined;
    const [seriesId, episodeId, pageNum, panelNum, bubbleNum] = slug;
    return repo.findBubble(
        seriesId,
        episodeId,
        Number(pageNum),
        Number(panelNum),
        Number(bubbleNum),
    );
};
export const findPanelsBySlug = (slug: string[]) => {
    if (slug.length < 5) return undefined;
    const [seriesId, episodeId, pageNum, panelStart, panelEnd] = slug;
    return repo.findPanels(
        seriesId,
        episodeId,
        Number(pageNum),
        Number(panelStart),
        Number(panelEnd),
    );
};
export const findReactionPanels = (tag: string) =>
    repo.findReactionPanels(tag);

// Re-export types for page convenience
export type {
    Series,
    Episode,
    Page,
    Panel,
    Bubble,
} from "@manga/domain";
