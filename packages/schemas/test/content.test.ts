import { test } from "node:test";
import assert from "node:assert/strict";
import { PageSchema, lintPageContent } from "../src/content.ts";

test("PageSchema and Linter Validation", async (t) => {
    await t.test("Page requires pageId or legacy id", () => {
        const missingPageId = {
            pageNumber: 1,
            width: 800,
            height: 1200,
            images: {},
            panels: [],
            bubbles: []
        };

        assert.throws(() => PageSchema.parse(missingPageId), /pageId is required/);
    });

    await t.test("Valid page passes validation with no warnings", () => {
        const validPage = {
            id: "page-1",
            pageNumber: 1,
            width: 800,
            height: 1200,
            images: {},
            panels: [
                {
                    id: "panel-1",
                    panelNumber: 1,
                    bbox: { x: 10, y: 10, width: 400, height: 300 }
                }
            ],
            bubbles: [
                {
                    id: "bubble-1",
                    bubbleNumber: 1,
                    bubbleType: "speech",
                    textOriginal: "Hello",
                    panelId: "panel-1",
                    bbox: { x: 20, y: 20, width: 100, height: 100 }
                }
            ]
        };

        const parsed = PageSchema.parse(validPage);
        const warnings = lintPageContent(parsed);
        assert.equal(warnings.length, 0);
    });

    await t.test("PanelId can be null (valid in V2 schema)", () => {
        const validFloatingBubble = {
            id: "page-1",
            pageNumber: 1,
            width: 800,
            height: 1200,
            images: {},
            panels: [],
            bubbles: [
                {
                    id: "bubble-1",
                    bubbleNumber: 1,
                    bubbleType: "narration",
                    textOriginal: "Meanwhile...",
                    panelId: null,
                    bbox: { x: 20, y: 20, width: 100, height: 100 }
                }
            ]
        };

        const parsed = PageSchema.parse(validFloatingBubble);
        const warnings = lintPageContent(parsed);
        assert.equal(warnings.length, 0);
    });

    await t.test("Linter emits error for invalid panelId reference", () => {
        const invalidHierarchy = {
            id: "page-1",
            pageNumber: 1,
            width: 800,
            height: 1200,
            images: {},
            panels: [],
            bubbles: [
                {
                    id: "bubble-1",
                    bubbleNumber: 1,
                    bubbleType: "speech",
                    textOriginal: "Hello",
                    panelId: "missing-panel",
                    bbox: { x: 20, y: 20, width: 100, height: 100 }
                }
            ]
        };

        // Zod parses it fine
        const parsed = PageSchema.parse(invalidHierarchy);
        
        // Linter catches the reference error
        const warnings = lintPageContent(parsed);
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0].code, "INVALID_PANEL_REF");
        assert.equal(warnings[0].severity, "error");
        assert.deepEqual(warnings[0].path, ["bubbles", 0, "panelId"]);
        assert.equal(warnings[0].source, "content-lint");
    });

    await t.test("Linter emits warning for out of bounds bounding boxes", () => {
        const outOfBounds = {
            id: "page-1",
            pageNumber: 1,
            width: 800,
            height: 1200,
            images: {},
            panels: [],
            bubbles: [
                {
                    id: "bubble-1",
                    bubbleNumber: 1,
                    bubbleType: "speech",
                    textOriginal: "Bleed!",
                    panelId: null,
                    bbox: { x: -50, y: 10, width: 100, height: 100 } // Negative x
                }
            ]
        };

        const parsed = PageSchema.parse(outOfBounds);
        const warnings = lintPageContent(parsed);
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0].severity, "warning");
        assert.equal(warnings[0].code, "BBOX_OUT_OF_BOUNDS");
    });

    await t.test("Linter emits warning when linked bubble bbox is outside panel bbox", () => {
        const outsidePanel = {
            id: "page-1",
            pageNumber: 1,
            width: 800,
            height: 1200,
            images: {},
            panels: [
                {
                    id: "panel-1",
                    panelNumber: 1,
                    bbox: { x: 10, y: 10, width: 100, height: 100 }
                }
            ],
            bubbles: [
                {
                    id: "bubble-1",
                    bubbleNumber: 1,
                    bubbleType: "speech",
                    textOriginal: "Outside",
                    panelId: "panel-1",
                    bbox: { x: 300, y: 300, width: 80, height: 80 }
                }
            ]
        };

        const parsed = PageSchema.parse(outsidePanel);
        const warnings = lintPageContent(parsed);
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0].severity, "warning");
        assert.equal(warnings[0].code, "BUBBLE_OUTSIDE_PANEL_BBOX");
        assert.equal(warnings[0].panelId, "panel-1");
        assert.equal(warnings[0].bubbleId, "bubble-1");
    });

    await t.test("Linter does not warn for default RTL panel reading order", () => {
        const rtlOrder = {
            id: "page-1",
            pageNumber: 1,
            width: 1200,
            height: 1600,
            images: {},
            panels: [
                {
                    id: "right-panel",
                    panelNumber: 1,
                    bbox: { x: 640, y: 40, width: 500, height: 320 }
                },
                {
                    id: "left-panel",
                    panelNumber: 2,
                    bbox: { x: 60, y: 40, width: 500, height: 320 }
                }
            ],
            bubbles: []
        };

        const parsed = PageSchema.parse(rtlOrder);
        const warnings = lintPageContent(parsed);
        assert.equal(warnings.some((warning) => warning.code === "READING_ORDER_SUSPECT"), false);
    });

    await t.test("Linter emits warning when panel order appears LTR", () => {
        const ltrOrder = {
            id: "page-1",
            pageNumber: 1,
            width: 1200,
            height: 1600,
            images: {},
            panels: [
                {
                    id: "left-panel",
                    panelNumber: 1,
                    bbox: { x: 60, y: 40, width: 500, height: 320 }
                },
                {
                    id: "right-panel",
                    panelNumber: 2,
                    bbox: { x: 640, y: 40, width: 500, height: 320 }
                }
            ],
            bubbles: []
        };

        const parsed = PageSchema.parse(ltrOrder);
        const warnings = lintPageContent(parsed);
        const readingOrderWarning = warnings.find((warning) => warning.code === "READING_ORDER_SUSPECT");
        assert.ok(readingOrderWarning);
        assert.equal(readingOrderWarning.severity, "warning");
        assert.deepEqual(readingOrderWarning.path, ["panels"]);
        assert.equal(readingOrderWarning.source, "content-lint");
    });
});
