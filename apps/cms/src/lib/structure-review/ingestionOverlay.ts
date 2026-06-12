import type { EpisodeData, IngestionReviewCandidate } from "../../api";
import type { BubbleTextComparisonOverlay } from "./bubbleDraft";

type UnknownRecord = Record<string, unknown>;

export type UnmatchedIngestionCandidate = {
    key: string;
    bubbleId?: string;
    reason: "missing_bubble_id" | "canonical_bubble_not_found";
};

function asRecord(value: unknown): UnknownRecord {
    return value && typeof value === "object" ? value as UnknownRecord : {};
}

function stringValue(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value;
    }
    return undefined;
}

function numberValue(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return undefined;
}

function bubbleIdOf(bubble: { bubbleId?: string; id?: string }) {
    return bubble.bubbleId ?? bubble.id ?? "";
}

function canonicalBubbleIdsOf(episode: EpisodeData) {
    const ids = new Set<string>();
    for (const page of episode.pages) {
        for (const bubble of page.bubbles ?? []) {
            ids.add(bubbleIdOf(bubble));
        }
        for (const panel of page.panels) {
            for (const bubble of panel.bubbles ?? []) {
                ids.add(bubbleIdOf(bubble));
            }
        }
    }
    return ids;
}

function candidateBubbleId(candidate: IngestionReviewCandidate) {
    const bubble = asRecord(candidate.bubble);
    return stringValue(bubble.bubbleId, bubble.id);
}

function overlayFromCandidate(candidate: IngestionReviewCandidate): BubbleTextComparisonOverlay {
    const bubble = asRecord(candidate.bubble);
    const metadata = asRecord(bubble.detectionMetadata);
    return {
        sourceText: stringValue(bubble.sourceText, bubble.source_text),
        ocrText: stringValue(bubble.ocrText, bubble.ocr_text),
        chosenText: stringValue(bubble.chosenText, bubble.chosen_text, bubble.textOriginal),
        confidence: numberValue(
            bubble.confidence,
            bubble.ocrConfidence,
            bubble.ocr_confidence,
            metadata.ocrConfidence,
            metadata.detectionConfidence,
        ),
    };
}

export function buildBubbleTextComparisonOverlayMap(
    episode: EpisodeData,
    candidates: readonly IngestionReviewCandidate[],
    onUnmatched?: (candidate: UnmatchedIngestionCandidate) => void,
) {
    const canonicalBubbleIds = canonicalBubbleIdsOf(episode);
    const overlays = new Map<string, BubbleTextComparisonOverlay>();

    for (const candidate of candidates) {
        if (candidate.target.kind !== "bubble" || !candidate.bubble) continue;
        const bubbleId = candidateBubbleId(candidate);
        if (!bubbleId) {
            onUnmatched?.({ key: candidate.key, reason: "missing_bubble_id" });
            continue;
        }
        if (!canonicalBubbleIds.has(bubbleId)) {
            onUnmatched?.({ key: candidate.key, bubbleId, reason: "canonical_bubble_not_found" });
            continue;
        }
        overlays.set(bubbleId, overlayFromCandidate(candidate));
    }

    return overlays;
}
