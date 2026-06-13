import test from "node:test";
import assert from "node:assert/strict";

import type { PageData } from "../../api.ts";
import { applyEstimatedReadingOrder, getPageReviewWarnings } from "./readingOrder.ts";

function makePage(): PageData {
    return {
        id: "p01",
        pageId: "p01",
        pageNumber: 1,
        images: { ja: "pages/p001.png" },
        width: 1200,
        height: 1800,
        panels: [
            {
                id: "p01-k001",
                panelId: "p01-k001",
                panelNumber: 1,
                bbox: { x: 24, y: 24, width: 552, height: 820 },
                reactionTags: [],
                bubbles: [
                    {
                        id: "p01-k001-f001",
                        bubbleId: "p01-k001-f001",
                        panelId: "p01-k001",
                        bubbleNumber: 1,
                        bubbleType: "speech",
                        textOriginal: "left",
                        textDirection: "vertical",
                        bbox: { x: 420, y: 80, width: 96, height: 120 },
                    },
                ],
            },
            {
                id: "p01-k002",
                panelId: "p01-k002",
                panelNumber: 2,
                bbox: { x: 624, y: 24, width: 552, height: 820 },
                reactionTags: [],
                bubbles: [
                    {
                        id: "p01-k002-f001",
                        bubbleId: "p01-k002-f001",
                        panelId: "p01-k002",
                        bubbleNumber: 2,
                        bubbleType: "speech",
                        textOriginal: "right",
                        textDirection: "vertical",
                        bbox: { x: 1020, y: 80, width: 96, height: 120 },
                    },
                ],
            },
        ],
        bubbles: [],
    };
}

test("getPageReviewWarnings flags mostly LTR panel order", () => {
    assert.deepEqual(getPageReviewWarnings(makePage()).map((warning) => warning.code), ["READING_ORDER_SUSPECT"]);
});

test("applyEstimatedReadingOrder reorders panels and clears reading-order warning", () => {
    const result = applyEstimatedReadingOrder(makePage());
    assert.equal(result.changedPanelCount, 2);
    assert.equal(result.page.panels[0]?.panelId, "p01-k002");
    assert.equal(result.page.panels[0]?.panelNumber, 1);
    assert.equal(result.page.panels[1]?.panelId, "p01-k001");
    assert.equal(result.page.panels[1]?.panelNumber, 2);
    assert.deepEqual(getPageReviewWarnings(result.page), []);
});
