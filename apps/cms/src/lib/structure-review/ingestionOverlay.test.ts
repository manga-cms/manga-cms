import assert from "node:assert/strict";
import test from "node:test";
import type { EpisodeData, IngestionReviewCandidate } from "../../api.ts";
import { buildBubbleTextComparisonOverlayMap } from "./ingestionOverlay.ts";

const episode: EpisodeData = {
    id: "ep01",
    episodeNumber: 1,
    title: "Episode One",
    publishedAt: "2026-06-05",
    pages: [
        {
            id: "page-1",
            pageNumber: 1,
            images: {},
            width: 100,
            height: 100,
            panels: [
                {
                    id: "panel-1",
                    panelNumber: 1,
                    bbox: { x: 0, y: 0, width: 100, height: 100 },
                    reactionTags: [],
                    bubbles: [
                        {
                            id: "bubble-1",
                            bubbleId: "bubble-1",
                            panelId: "panel-1",
                            bubbleNumber: 1,
                            bubbleType: "speech",
                            textOriginal: "canonical text",
                            bbox: { x: 1, y: 2, width: 30, height: 20 },
                        },
                    ],
                },
            ],
            bubbles: [
                {
                    id: "bubble-1",
                    bubbleId: "bubble-1",
                    panelId: "panel-1",
                    bubbleNumber: 1,
                    bubbleType: "speech",
                    textOriginal: "canonical text",
                    bbox: { x: 1, y: 2, width: 30, height: 20 },
                },
            ],
        },
    ],
};

test("buildBubbleTextComparisonOverlayMap matches candidates by exact bubbleId only", () => {
    const unmatched: unknown[] = [];
    const candidates: IngestionReviewCandidate[] = [
        {
            key: "bubble:matched",
            target: { kind: "bubble", pageNumber: 1, panelNumber: 1, bubbleNumber: 1 },
            decision: "pending",
            bubble: {
                bubbleId: "bubble-1",
                bubbleNumber: 1,
                bubbleType: "speech",
                textOriginal: "chosen text",
                sourceText: "PSD text",
                ocrText: "OCR text",
                confidence: 0.62,
            },
        },
        {
            key: "bubble:short-id-only",
            target: { kind: "bubble", pageNumber: 1, panelNumber: 1, bubbleNumber: 2 },
            decision: "pending",
            bubble: {
                bubbleNumber: 2,
                bubbleType: "speech",
                textOriginal: "unmatched",
                shortId: "bubble-1",
                sourceText: "must not match by shortId",
            },
        },
        {
            key: "bubble:unknown-id",
            target: { kind: "bubble", pageNumber: 1, panelNumber: 1, bubbleNumber: 3 },
            decision: "pending",
            bubble: {
                bubbleId: "bubble-missing",
                bubbleNumber: 3,
                bubbleType: "speech",
                textOriginal: "unmatched",
                sourceText: "must be ignored",
            },
        },
    ];

    const overlays = buildBubbleTextComparisonOverlayMap(episode, candidates, (candidate) => unmatched.push(candidate));

    assert.equal(overlays.size, 1);
    assert.deepEqual(overlays.get("bubble-1"), {
        sourceText: "PSD text",
        ocrText: "OCR text",
        chosenText: "chosen text",
        confidence: 0.62,
    });
    assert.deepEqual(unmatched, [
        { key: "bubble:short-id-only", reason: "missing_bubble_id" },
        { key: "bubble:unknown-id", bubbleId: "bubble-missing", reason: "canonical_bubble_not_found" },
    ]);
    assert.equal(JSON.stringify(episode).includes("sourceText"), false);
    assert.equal(JSON.stringify(episode).includes("ocrText"), false);
    assert.equal(JSON.stringify(episode).includes("confidence"), false);
});

test("buildBubbleTextComparisonOverlayMap reads detection metadata as fallback confidence", () => {
    const overlays = buildBubbleTextComparisonOverlayMap(episode, [
        {
            key: "bubble:metadata-confidence",
            target: { kind: "bubble", pageNumber: 1, panelNumber: 1, bubbleNumber: 1 },
            decision: "pending",
            bubble: {
                bubbleId: "bubble-1",
                bubbleNumber: 1,
                bubbleType: "speech",
                textOriginal: "chosen text",
                detectionMetadata: { ocrConfidence: 0.91 },
            },
        },
    ]);

    assert.equal(overlays.get("bubble-1")?.confidence, 0.91);
});
