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
            width: page.width ?? input.defaultWidth ?? 500,
            height: page.height ?? input.defaultHeight ?? 760,
            displayRef: page.displayRef,
            panels: [],
        })),
    };
}
