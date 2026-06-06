import type { InputSourceKind } from "./bbox.js";

export interface PageAssetReference {
    pageNumber: number;
    pageId: string;
    imagePath: string;
    width?: number;
    height?: number;
}

export interface TextSourceRecord {
    id: string;
    source: Exclude<InputSourceKind, "page_image" | "manual">;
    text: string;
    order?: number;
    layerName?: string;
}

export interface PageInput {
    jobId: string;
    seriesId: string;
    episodeId: string;
    episodeNumber: number;
    episodeTitle: string;
    page: PageAssetReference;
    sourceTexts?: TextSourceRecord[];
    locale?: string;
}

export interface EpisodeInput {
    jobId: string;
    seriesId: string;
    seriesTitle: string;
    seriesDescription?: string;
    seriesStatus?: "ongoing" | "completed" | "hiatus";
    episodeId: string;
    episodeNumber: number;
    episodeTitle: string;
    pages: PageInput[];
}
