import type { DraftPayload } from "@manga/domain";

export interface PreparedDirectoryPageInput {
    pageNumber?: number;
    imagePath: string;
    sourceImagePath?: string;
    width?: number;
    height?: number;
    displayRef?: string;
}

export interface PreparedDirectoryDraftInput {
    seriesId: string;
    seriesTitle: string;
    seriesDescription?: string;
    seriesStatus?: "ongoing" | "completed" | "hiatus";
    episodeId: string;
    episodeNumber: number;
    episodeTitle: string;
    pages: PreparedDirectoryPageInput[];
    defaultWidth?: number;
    defaultHeight?: number;
}

function resolvePageDimension(pageValue: number | undefined, defaultValue: number | undefined, label: string): number {
    const value = pageValue ?? defaultValue;
    if (value === undefined || !Number.isFinite(value) || value < 1) {
        throw new Error(`Prepared directory page ${label} is required and must be a positive number`);
    }
    return value;
}

export function buildPreparedDirectoryDraft(input: PreparedDirectoryDraftInput): DraftPayload {
    return {
        seriesId: input.seriesId,
        seriesTitle: input.seriesTitle,
        seriesDescription: input.seriesDescription,
        seriesStatus: input.seriesStatus ?? "ongoing",
        episodeId: input.episodeId,
        episodeNumber: input.episodeNumber,
        episodeTitle: input.episodeTitle,
        pages: input.pages.map((page, index) => ({
            pageNumber: page.pageNumber ?? index + 1,
            imagePath: page.imagePath,
            sourceImagePath: page.sourceImagePath,
            width: resolvePageDimension(page.width, input.defaultWidth, "width"),
            height: resolvePageDimension(page.height, input.defaultHeight, "height"),
            displayRef: page.displayRef,
            panels: [],
        })),
    };
}
