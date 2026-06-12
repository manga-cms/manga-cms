import type { BoundingBox, BubbleData, PageData, PanelData } from "../../api";
import { bubbleIdOf } from "./ids";
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

export interface BubbleTextComparisonOverlay {
    sourceText?: string;
    ocrText?: string;
    chosenText?: string;
    confidence?: number;
}

export type BubbleTextComparisonOverlayMap = ReadonlyMap<string, BubbleTextComparisonOverlay>;

export function getBubbleSourceText(bubble: BubbleData) {
    return bubble.textOriginal;
}

function normalizeCandidateText(value: unknown): string {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}

export function formatBboxSummary(box: BoundingBox) {
    return `x:${Math.round(box.x)}, y:${Math.round(box.y)}, w:${Math.round(box.width)}, h:${Math.round(box.height)}`;
}

export function getBubbleWarnings(page: PageData | null, bubble: BubbleData, textComparison?: BubbleTextComparisonOverlay) {
    const warnings: string[] = [];
    if (!getBubbleSourceText(bubble).trim()) warnings.push("missingText");
    if (bubble.bbox.width < 24 || bubble.bbox.height < 24) warnings.push("smallBbox");
    if (page && (bubble.bbox.x < 0 || bubble.bbox.y < 0 || bubble.bbox.x + bubble.bbox.width > page.width || bubble.bbox.y + bubble.bbox.height > page.height)) {
        warnings.push("outsidePage");
    }
    if ((bubble.bubbleType === "speech" || bubble.bubbleType === "thought") && !bubble.speaker?.trim()) warnings.push("missingSpeaker");
    const comparison = getBubbleTextComparison(bubble, textComparison);
    if (comparison) {
        const chosenText = normalizeCandidateText(comparison.chosenText);
        if (comparison.confidence !== undefined && comparison.confidence < 0.75) warnings.push("lowConfidence");
        if (comparison.sourceText && normalizeCandidateText(comparison.sourceText) !== chosenText) warnings.push("sourceTextDiffers");
        if (comparison.ocrText && normalizeCandidateText(comparison.ocrText) !== chosenText) warnings.push("ocrTextDiffers");
    }
    return warnings;
}

export type ReviewDisplayState = "candidate" | "confirmed" | "rejected" | "needs_review";

export function getReviewDisplayState(decision: ReviewDecision | undefined, warnings: readonly string[] = []): ReviewDisplayState {
    if (decision === "rejected") return "rejected";
    if (decision === "accepted") return warnings.length > 0 ? "needs_review" : "confirmed";
    return warnings.length > 0 ? "needs_review" : "candidate";
}

// Text comparison data is supplied by ingestion job review-candidates
// (runtime state) as an explicit bubbleId overlay. Do not write sourceText,
// ocrText, chosenText, or confidence to canonical Bubble data or
// ContentPublicMetadata; metadata is public share metadata.
export function getBubbleTextComparison(bubble: BubbleData, overlay?: BubbleTextComparisonOverlay) {
    if (!overlay) return null;
    const sourceText = overlay.sourceText?.trim() ? overlay.sourceText : undefined;
    const ocrText = overlay.ocrText?.trim() ? overlay.ocrText : undefined;
    const chosenText = overlay.chosenText?.trim() ? overlay.chosenText : getBubbleSourceText(bubble);
    const confidence = overlay.confidence !== undefined && Number.isFinite(overlay.confidence) ? overlay.confidence : undefined;
    if (!sourceText && !ocrText && confidence === undefined) return null;
    return {
        sourceText,
        ocrText,
        chosenText,
        confidence,
    };
}

export function getBubbleTextComparisonBadges(bubble: BubbleData, overlay?: BubbleTextComparisonOverlay) {
    const comparison = getBubbleTextComparison(bubble, overlay);
    if (!comparison) {
        return {
            hasSourceText: false,
            hasOcrText: false,
            sourceDiffers: false,
            ocrDiffers: false,
            confidence: undefined,
        };
    }
    const chosenText = normalizeCandidateText(comparison.chosenText);
    return {
        hasSourceText: Boolean(comparison.sourceText),
        hasOcrText: Boolean(comparison.ocrText),
        sourceDiffers: Boolean(comparison.sourceText && normalizeCandidateText(comparison.sourceText) !== chosenText),
        ocrDiffers: Boolean(comparison.ocrText && normalizeCandidateText(comparison.ocrText) !== chosenText),
        confidence: comparison.confidence,
    };
}

export function getBubbleCandidates(page: PageData | null, reviewDecisions: ReviewDecisions, textComparisonOverlays?: BubbleTextComparisonOverlayMap): BubbleCandidate[] {
    if (!page) return [];
    let readingOrder = 0;
    const panelBubbles = page.panels.flatMap((panel, panelIndex) => panel.bubbles.map((bubble, bubbleIndex) => {
        readingOrder += 1;
        const overlay = textComparisonOverlays?.get(bubbleIdOf(bubble));
        return {
            bubble,
            panel,
            panelIndex,
            bubbleIndex,
            readingOrder,
            decision: reviewDecisions[bubbleReviewKey(bubble)] ?? "pending",
            warnings: getBubbleWarnings(page, bubble, overlay),
        };
    }));
    const pageLevelBubbles = (page.bubbles ?? [])
        .filter((bubble) => bubble.panelId === null)
        .map((bubble, bubbleIndex) => {
            readingOrder += 1;
            const overlay = textComparisonOverlays?.get(bubbleIdOf(bubble));
            return {
                bubble,
                panel: null,
                panelIndex: null,
                bubbleIndex,
                readingOrder,
                decision: reviewDecisions[bubbleReviewKey(bubble)] ?? "pending",
                warnings: getBubbleWarnings(page, bubble, overlay),
            };
        });
    return [...panelBubbles, ...pageLevelBubbles];
}
