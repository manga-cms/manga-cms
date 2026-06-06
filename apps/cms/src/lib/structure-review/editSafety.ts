import type { EpisodeData } from "../../api";
import type { ReviewDecisions } from "./types";

export type StructureReviewSnapshot = {
    episode: EpisodeData;
    reviewDecisions: ReviewDecisions;
    pageIndex: number;
    selectedPanelIndex: number | null;
    selectedBubbleIndex: number | null;
    scriptAssistText: string;
};

export type StructureReviewAutosave = StructureReviewSnapshot & {
    savedAt: string;
    version: 1;
};

const AUTOSAVE_PREFIX = "manga-cms:structure-review";

export function makeAutosaveKey(seriesId: string, episodeId: string) {
    return `${AUTOSAVE_PREFIX}:${seriesId}:${episodeId}`;
}

export function serializeSnapshot(snapshot: StructureReviewSnapshot) {
    return JSON.stringify(snapshot);
}

export function readAutosave(key: string): StructureReviewAutosave | null {
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StructureReviewAutosave;
        if (parsed.version !== 1 || !parsed.episode || !parsed.reviewDecisions) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function writeAutosave(key: string, snapshot: StructureReviewSnapshot) {
    const payload: StructureReviewAutosave = {
        ...snapshot,
        savedAt: new Date().toISOString(),
        version: 1,
    };
    try {
        window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
        // Autosave is best-effort; editing should continue when storage is unavailable.
    }
}

export function clearAutosave(key: string) {
    try {
        window.localStorage.removeItem(key);
    } catch {
        // Save success should not be blocked by storage cleanup.
    }
}

export function confirmStructureReviewLeave(dirty: boolean, message: string) {
    if (!dirty) return true;
    return window.confirm(message);
}
