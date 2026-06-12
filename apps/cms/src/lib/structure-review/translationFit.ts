import type { BoundingBox } from "../../api";

export type TranslationFitStatus = "ok" | "tight" | "warning";

export type TranslationFitEstimate = {
    status: TranslationFitStatus;
    characterCount: number;
    estimatedCapacity: number;
    ratio: number;
};

export type TranslationFitDirection = "horizontal" | "vertical";

const BASE_PAGE_WIDTH = 1200;

function countCharacters(text: string) {
    return Array.from(text.replace(/\s+/g, "")).length;
}

function estimateCapacity(box: BoundingBox, direction: TranslationFitDirection = "horizontal", pageWidth = BASE_PAGE_WIDTH) {
    const width = Math.max(1, box.width);
    const height = Math.max(1, box.height);
    // Canonical bbox coordinates are page-pixel based. Use a 1200px-wide page
    // as the heuristic baseline until textStyle.fontSizePx exists in contract.
    const scale = Math.max(0.25, pageWidth / BASE_PAGE_WIDTH);
    const lineStep = (direction === "horizontal" ? 24 : 26) * scale;
    const charStep = (direction === "horizontal" ? 15 : 18) * scale;
    const charsPerLine = direction === "horizontal"
        ? Math.max(4, Math.floor(width / charStep))
        : Math.max(4, Math.floor(height / charStep));
    const lines = direction === "horizontal"
        ? Math.max(1, Math.floor(height / lineStep))
        : Math.max(1, Math.floor(width / lineStep));
    return Math.max(8, charsPerLine * lines);
}

export function estimateTranslationFit(input: {
    text: string;
    bbox: BoundingBox;
    textDirection?: TranslationFitDirection;
    pageWidth?: number;
}): TranslationFitEstimate {
    const characterCount = countCharacters(input.text);
    const estimatedCapacity = estimateCapacity(input.bbox, input.textDirection ?? "horizontal", input.pageWidth);
    const ratio = estimatedCapacity === 0 ? 0 : characterCount / estimatedCapacity;
    return {
        status: ratio > 1 ? "warning" : ratio >= 0.85 ? "tight" : "ok",
        characterCount,
        estimatedCapacity,
        ratio,
    };
}
