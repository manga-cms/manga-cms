import type { BoundingBox, BubbleData, PageData, PanelData } from "../../api";
import { bubbleReviewKey } from "./reviewDecisions";
import type { ReviewDecision, ReviewDecisions } from "./types";

export type BubbleCandidate = {
    bubble: BubbleData;
    panel: PanelData | null;
    panelIndex: number | null;
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

export type ReviewDisplayState = "candidate" | "confirmed" | "rejected" | "needs_review";

export function getReviewDisplayState(decision: ReviewDecision | undefined, warnings: readonly string[] = []): ReviewDisplayState {
    if (decision === "rejected") return "rejected";
    if (decision === "accepted") return warnings.length > 0 ? "needs_review" : "confirmed";
    return warnings.length > 0 ? "needs_review" : "candidate";
}

function optionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getBubbleTextComparison(bubble: BubbleData) {
    const candidate = bubble as BubbleData & {
        sourceText?: unknown;
        ocrText?: unknown;
        chosenText?: unknown;
        confidence?: unknown;
        ocrConfidence?: unknown;
        metadata?: Record<string, unknown>;
    };
    const metadata = candidate.metadata ?? {};
    const sourceText = optionalString(candidate.sourceText) ?? optionalString(metadata.sourceText);
    const ocrText = optionalString(candidate.ocrText) ?? optionalString(metadata.ocrText);
    const chosenText = optionalString(candidate.chosenText) ?? optionalString(metadata.chosenText) ?? getBubbleSourceText(bubble);
    const confidence = optionalNumber(candidate.confidence) ??
        optionalNumber(candidate.ocrConfidence) ??
        optionalNumber(metadata.confidence) ??
        optionalNumber(metadata.ocrConfidence);

    return {
        sourceText,
        ocrText,
        chosenText,
        confidence,
    };
}

export function getBubbleCandidates(page: PageData | null, reviewDecisions: ReviewDecisions): BubbleCandidate[] {
    if (!page) return [];
    let readingOrder = 0;
    const panelBubbles = page.panels.flatMap((panel, panelIndex) => panel.bubbles.map((bubble, bubbleIndex) => {
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
    const pageLevelBubbles = (page.bubbles ?? [])
        .filter((bubble) => bubble.panelId === null)
        .map((bubble, bubbleIndex) => {
            readingOrder += 1;
            return {
                bubble,
                panel: null,
                panelIndex: null,
                bubbleIndex,
                readingOrder,
                decision: reviewDecisions[bubbleReviewKey(bubble)] ?? "pending",
                warnings: getBubbleWarnings(page, bubble),
            };
        });
    return [...panelBubbles, ...pageLevelBubbles];
}
