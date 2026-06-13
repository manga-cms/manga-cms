import test from "node:test";
import assert from "node:assert/strict";

import type { PageData } from "../../api.ts";
import { moveBubbleByGlobalReadingOrder } from "./bubbleOrdering.ts";

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
                bbox: { x: 624, y: 24, width: 552, height: 820 },
                reactionTags: [],
                bubbles: [
                    {
                        id: "p01-k001-f001",
                        bubbleId: "p01-k001-f001",
                        panelId: "p01-k001",
                        bubbleNumber: 1,
                        bubbleType: "speech",
                        textOriginal: "A",
                        textDirection: "vertical",
                        bbox: { x: 1020, y: 80, width: 96, height: 120 },
                    },
                ],
            },
            {
                id: "p01-k002",
                panelId: "p01-k002",
                panelNumber: 2,
                bbox: { x: 24, y: 24, width: 552, height: 820 },
                reactionTags: [],
                bubbles: [
                    {
                        id: "p01-k002-f001",
                        bubbleId: "p01-k002-f001",
                        panelId: "p01-k002",
                        bubbleNumber: 2,
                        bubbleType: "speech",
                        textOriginal: "B",
                        textDirection: "vertical",
                        bbox: { x: 420, y: 80, width: 96, height: 120 },
                    },
                ],
            },
        ],
        bubbles: [],
    };
}

test("moveBubbleByGlobalReadingOrder can move a Bubble across Panel boundaries", () => {
    const result = moveBubbleByGlobalReadingOrder(makePage(), "p01-k002-f001", -1);

    assert.equal(result.changed, true);
    assert.equal(result.selectedPanelIndex, 0);
    assert.equal(result.selectedBubbleIndex, 0);
    assert.deepEqual(result.page.panels[0]?.bubbles.map((bubble) => bubble.textOriginal), ["B", "A"]);
    assert.deepEqual(result.page.panels[1]?.bubbles.map((bubble) => bubble.textOriginal), []);
    assert.equal(result.page.panels[0]?.bubbles[0]?.panelId, "p01-k001");
    assert.deepEqual(result.page.bubbles.map((bubble) => bubble.textOriginal), ["B", "A"]);
});

test("moveBubbleByGlobalReadingOrder can move a Bubble to page-level order", () => {
    const page = {
        ...makePage(),
        bubbles: [
            {
                id: "p01-f001",
                bubbleId: "p01-f001",
                panelId: null,
                bubbleNumber: 3,
                bubbleType: "caption" as const,
                textOriginal: "caption",
                textDirection: "horizontal" as const,
                bbox: { x: 40, y: 900, width: 400, height: 80 },
            },
        ],
    };

    const result = moveBubbleByGlobalReadingOrder(page, "p01-k002-f001", 1);

    assert.equal(result.changed, true);
    assert.equal(result.selectedPanelIndex, null);
    assert.equal(result.selectedBubbleIndex, 1);
    assert.deepEqual(result.page.panels[1]?.bubbles.map((bubble) => bubble.textOriginal), []);
    assert.deepEqual(result.page.bubbles.map((bubble) => bubble.textOriginal), ["A", "caption", "B"]);
    assert.equal(result.page.bubbles[1]?.panelId, null);
    assert.equal(result.page.bubbles[1]?.displayRef, "p1-f1");
    assert.equal(result.page.bubbles[2]?.panelId, null);
    assert.equal(result.page.bubbles[2]?.displayRef, "p1-f2");
});
