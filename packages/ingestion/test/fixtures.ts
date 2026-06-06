import type { EpisodeInput, PageInput } from "../src/types/index.ts";

export function createPageInput(overrides: Partial<PageInput> = {}): PageInput {
    return {
        jobId: "job-fixture",
        seriesId: "rain-world",
        episodeId: "ep01",
        episodeNumber: 1,
        episodeTitle: "Rain Ruins",
        page: {
            pageNumber: 1,
            pageId: "rain-world-ep01-p001",
            imagePath: "pages/p001.jpg",
            width: 1600,
            height: 2400,
        },
        sourceTexts: [
            {
                id: "src-1",
                source: "clip_text_export",
                text: "今日は雨だね",
                order: 1,
            },
            {
                id: "src-2",
                source: "clip_text_export",
                text: "雨はまだ止まない。",
                order: 2,
            },
        ],
        locale: "ja",
        ...overrides,
    };
}

export function createEpisodeInput(overrides: Partial<EpisodeInput> = {}): EpisodeInput {
    const page = createPageInput();
    return {
        jobId: "job-fixture",
        seriesId: "rain-world",
        seriesTitle: "Rain World",
        seriesDescription: "Fixture series",
        seriesStatus: "ongoing",
        episodeId: "ep01",
        episodeNumber: 1,
        episodeTitle: "Rain Ruins",
        pages: [page],
        ...overrides,
    };
}
