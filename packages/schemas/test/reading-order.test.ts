import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateBubbleReadingOrder, estimatePanelReadingOrder } from "../src/reading-order.ts";

function box(x: number, y: number, width: number, height: number) {
    return { x, y, width, height };
}

function scaleBox(input: ReturnType<typeof box>, scale: number) {
    return {
        x: input.x * scale,
        y: input.y * scale,
        width: input.width * scale,
        height: input.height * scale,
    };
}

test("estimatePanelReadingOrder sorts 2-1-2 layout by tier then RTL", () => {
    const panels = [
        { panelId: "top-left", bbox: box(60, 40, 500, 320) },
        { panelId: "top-right", bbox: box(640, 42, 500, 318) },
        { panelId: "middle-wide", bbox: box(60, 430, 1080, 280) },
        { panelId: "bottom-left", bbox: box(60, 790, 500, 320) },
        { panelId: "bottom-right", bbox: box(640, 788, 500, 322) },
    ];

    assert.deepEqual(estimatePanelReadingOrder(panels), [
        "top-right",
        "top-left",
        "middle-wide",
        "bottom-right",
        "bottom-left",
    ]);
});

test("estimatePanelReadingOrder sorts three tiers top to bottom", () => {
    const panels = [
        { panelId: "bottom", bbox: box(80, 820, 1040, 300) },
        { panelId: "middle-left", bbox: box(80, 430, 460, 300) },
        { panelId: "top", bbox: box(80, 40, 1040, 300) },
        { panelId: "middle-right", bbox: box(660, 430, 460, 300) },
    ];

    assert.deepEqual(estimatePanelReadingOrder(panels), [
        "top",
        "middle-right",
        "middle-left",
        "bottom",
    ]);
});

test("estimatePanelReadingOrder sorts 3x2 plus wide layout", () => {
    const panels = [
        { panelId: "top-left", bbox: box(60, 40, 320, 260) },
        { panelId: "top-middle", bbox: box(440, 40, 320, 260) },
        { panelId: "top-right", bbox: box(820, 40, 320, 260) },
        { panelId: "wide", bbox: box(60, 360, 1080, 260) },
        { panelId: "bottom-left", bbox: box(60, 700, 320, 260) },
        { panelId: "bottom-middle", bbox: box(440, 700, 320, 260) },
        { panelId: "bottom-right", bbox: box(820, 700, 320, 260) },
    ];

    assert.deepEqual(estimatePanelReadingOrder(panels), [
        "top-right",
        "top-middle",
        "top-left",
        "wide",
        "bottom-right",
        "bottom-middle",
        "bottom-left",
    ]);
});

test("estimatePanelReadingOrder is resolution independent", () => {
    const base = [
        { panelId: "left", bbox: box(60, 40, 500, 320) },
        { panelId: "right", bbox: box(640, 40, 500, 320) },
        { panelId: "wide", bbox: box(60, 430, 1080, 300) },
    ];
    const highResolution = base.map((panel) => ({
        ...panel,
        bbox: scaleBox(panel.bbox, 2.5),
    }));

    assert.deepEqual(estimatePanelReadingOrder(base), ["right", "left", "wide"]);
    assert.deepEqual(estimatePanelReadingOrder(highResolution), ["right", "left", "wide"]);
});

test("estimateBubbleReadingOrder uses panel order, RTL columns, then page-level bubbles", () => {
    const page = {
        width: 1200,
        height: 1600,
        panels: [
            { panelId: "left-panel", bbox: box(60, 40, 500, 600) },
            { panelId: "right-panel", bbox: box(640, 40, 500, 600) },
        ],
        bubbles: [
            { bubbleId: "left-panel-bubble", panelId: "left-panel", bbox: box(360, 100, 120, 100) },
            { bubbleId: "right-column-bottom", panelId: "right-panel", bbox: box(940, 260, 120, 100) },
            { bubbleId: "right-column-top", panelId: "right-panel", bbox: box(940, 100, 120, 100) },
            { bubbleId: "left-column", panelId: "right-panel", bbox: box(720, 120, 120, 100) },
            { bubbleId: "page-level", panelId: null, bbox: box(880, 760, 180, 80) },
        ],
    };

    assert.deepEqual(estimateBubbleReadingOrder(page), [
        "right-column-top",
        "right-column-bottom",
        "left-column",
        "left-panel-bubble",
        "page-level",
    ]);
});

