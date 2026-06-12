import type { BoundingBox } from "../../api";

export type TranslationFitStatus = "ok" | "warning";

export type TranslationFitEstimate = {
    status: TranslationFitStatus;
    characterCount: number;
    estimatedCapacity: number;
    ratio: number;
};

export type TranslationFitDirection = "horizontal" | "vertical";

function countCharacters(text: string) {
    return Array.from(text.replace(/\s+/g, "")).length;
}

function estimateCapacity(box: BoundingBox, direction: TranslationFitDirection = "vertical") {
    const width = Math.max(1, box.width);
    const height = Math.max(1, box.height);
    const lineStep = direction === "horizontal" ? 24 : 26;
    const charStep = direction === "horizontal" ? 15 : 18;
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
}): TranslationFitEstimate {
    const characterCount = countCharacters(input.text);
    const estimatedCapacity = estimateCapacity(input.bbox, input.textDirection ?? "vertical");
    const ratio = estimatedCapacity === 0 ? 0 : characterCount / estimatedCapacity;
    return {
        status: ratio > 1 ? "warning" : "ok",
        characterCount,
        estimatedCapacity,
        ratio,
    };
}
