import type { BoundingBox, BubbleData, PageData, PanelData } from "../../api";
import { bubbleReviewKey } from "./reviewDecisions";
import type { ReviewDecision, ReviewDecisions } from "./types";

export type BubbleCandidate = {
    bubble: BubbleData;
    panel: PanelData;
    panelIndex: number;
    bubbleIndex: number;
    readingOrder: number;
    decision: ReviewDecision;
    warnings: string[];
};

export function getBubbleSourceText(bubble: BubbleData) {
    return bubble.textOriginal;
}

export function formatBboxSummary(box: BoundingBox) {
    return `x:${Math.round(box.x)}, y:${Math.round(box.y)}, w:${Math.round(box.width)}, h:${Math.round(box.height)}`;
}

export function getBubbleWarnings(page: PageData | null, bubble: BubbleData) {
    const warnings: string[] = [];
    if (!getBubbleSourceText(bubble).trim()) warnings.push("missingText");
    if (bubble.bbox.width < 24 || bubble.bbox.height < 24) warnings.push("smallBbox");
    if (page && (bubble.bbox.x < 0 || bubble.bbox.y < 0 || bubble.bbox.x + bubble.bbox.width > page.width || bubble.bbox.y + bubble.bbox.height > page.height)) {
        warnings.push("outsidePage");
    }
    if ((bubble.bubbleType === "speech" || bubble.bubbleType === "thought") && !bubble.speaker?.trim()) warnings.push("missingSpeaker");
    return warnings;
}

export function getBubbleCandidates(page: PageData | null, reviewDecisions: ReviewDecisions): BubbleCandidate[] {
    if (!page) return [];
    let readingOrder = 0;
    return page.panels.flatMap((panel, panelIndex) => panel.bubbles.map((bubble, bubbleIndex) => {
        readingOrder += 1;
        return {
            bubble,
            panel,
            panelIndex,
            bubbleIndex,
            readingOrder,
            decision: reviewDecisions[bubbleReviewKey(bubble)] ?? "pending",
            warnings: getBubbleWarnings(page, bubble),
        };
    }));
}
