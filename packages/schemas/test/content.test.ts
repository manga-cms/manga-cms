import { test } from "node:test";
import assert from "node:assert/strict";
import { PackManifestSchema, PageSchema, PublishedPackSchema, lintPackContent, lintPageContent } from "../src/content.ts";

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

    await t.test("Bubble accepts lettering layout and style hints", () => {
        const page = PageSchema.parse({
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
                    textOriginal: "こんにちは世界",
                    panelId: null,
                    textLayout: {
                        lines: ["こんにちは", "世界"],
                        inlineAlign: "start",
                        blockAlign: "center",
                        offsetXPercent: 12.5,
                        offsetYPercent: -8,
                        source: "manual",
                    },
                    textStyle: {
                        fontSizePx: 28,
                        fontWeight: 500,
                        lineHeight: 1.2,
                        letterSpacing: 1.5,
                        fitMode: "fixed",
                    },
                    bbox: { x: 20, y: 20, width: 100, height: 100 },
                },
            ],
        });

        assert.deepEqual(page.bubbles[0].textLayout?.lines, ["こんにちは", "世界"]);
        assert.equal(page.bubbles[0].textLayout?.offsetXPercent, 12.5);
        assert.equal(page.bubbles[0].textLayout?.offsetYPercent, -8);
        assert.equal(page.bubbles[0].textStyle?.fontWeight, 500);
    });

    await t.test("Bubble rejects invalid lettering style values", () => {
        assert.throws(() => PageSchema.parse({
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
                    panelId: null,
                    textStyle: {
                        fontSizePx: -1,
                        fontWeight: 450,
                        lineHeight: 0,
                    },
                    bbox: { x: 20, y: 20, width: 100, height: 100 },
                },
            ],
        }), /fontWeight|Number must be greater than/);
    });

    await t.test("Linter warns for stale textLayout lines and invalid fitMode pairing", () => {
        const page = PageSchema.parse({
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
                    textOriginal: "こんにちは",
                    panelId: null,
                    textLayout: { lines: ["こんばんは"] },
                    textStyle: { fitMode: "fixed" },
                    bbox: { x: 20, y: 20, width: 100, height: 100 },
                },
            ],
        });

        const warnings = lintPageContent(page);
        assert.ok(warnings.some((warning) => warning.code === "TEXT_LAYOUT_TEXT_MISMATCH"));
        assert.ok(warnings.some((warning) => warning.code === "TEXT_STYLE_FITMODE_WITHOUT_FONT_SIZE"));
    });

    await t.test("Linter allows manual lettering lines to differ from source text", () => {
        const page = PageSchema.parse({
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
                    textOriginal: "こんにちは",
                    panelId: null,
                    textLayout: { lines: ["こんにちは！"], source: "manual" },
                    bbox: { x: 20, y: 20, width: 100, height: 100 },
                },
            ],
        });

        const warnings = lintPageContent(page);
        assert.equal(warnings.some((warning) => warning.code === "TEXT_LAYOUT_TEXT_MISMATCH"), false);
    });
});

test("PublishedPackSchema omits private Pack entry metadata", () => {
    const parsed = PublishedPackSchema.parse({
        id: "translation-en-demo",
        type: "TRANSLATION",
        language: "en",
        version: 1,
        isPublished: true,
        entries: [{
            id: "entry-1",
            target: {
                seriesId: "series-1",
                episodeId: "ep01",
                pageId: "p01",
                bubbleId: "b01",
            },
            text: "Hello",
            textLayout: { lines: ["Hel", "lo"], inlineAlign: "center", offsetXPercent: 10 },
            textStyle: { fontSizePx: 24, fontWeight: 700, fitMode: "shrink" },
            metadata: {
                translation_origin: "machine",
                provider: "gemini",
            },
        }],
    });

    assert.equal("metadata" in parsed.entries[0], false);
    assert.deepEqual(parsed.entries[0].textLayout?.lines, ["Hel", "lo"]);
    assert.equal(parsed.entries[0].textLayout?.offsetXPercent, 10);
    assert.equal(parsed.entries[0].textStyle?.fontWeight, 700);
});

test("Pack lint warns for stale translation textLayout lines", () => {
    const pack = PackManifestSchema.parse({
        id: "translation-en-demo",
        type: "TRANSLATION",
        language: "en",
        version: 1,
        isPublished: false,
        entries: [{
            id: "entry-1",
            target: { seriesId: "series-1", bubbleId: "b01" },
            text: "Hello world",
            textLayout: { lines: ["Goodbye", "world"] },
            textStyle: { fitMode: "shrink" },
        }],
    });

    const warnings = lintPackContent(pack);
    assert.ok(warnings.some((warning) => warning.code === "TEXT_LAYOUT_TEXT_MISMATCH"));
    assert.ok(warnings.some((warning) => warning.code === "TEXT_STYLE_FITMODE_WITHOUT_FONT_SIZE"));
});

test("Pack lint allows manual translation lettering lines to differ from entry text", () => {
    const pack = PackManifestSchema.parse({
        id: "translation-en-demo",
        type: "TRANSLATION",
        language: "en",
        version: 1,
        isPublished: false,
        entries: [{
            id: "entry-1",
            target: { seriesId: "series-1", bubbleId: "b01" },
            text: "Hello world",
            textLayout: { lines: ["Hello,", "world!"], source: "manual" },
        }],
    });

    const warnings = lintPackContent(pack);
    assert.equal(warnings.some((warning) => warning.code === "TEXT_LAYOUT_TEXT_MISMATCH"), false);
});
