import assert from "node:assert/strict";
import { test } from "node:test";
import {
    buildLetteringRender,
    displayDirectionForLanguage,
    renderTextForLettering,
    resolvedFitMode,
    sanitizeTextLayout,
    sanitizeTextStyle,
} from "../src/index.ts";

test("displayDirectionForLanguage preserves source direction and makes translations horizontal", () => {
    assert.equal(displayDirectionForLanguage("vertical", "ja"), "vertical");
    assert.equal(displayDirectionForLanguage("horizontal", "ja"), "horizontal");
    assert.equal(displayDirectionForLanguage("vertical", "en"), "horizontal");
    assert.equal(displayDirectionForLanguage("vertical", "zh-Hans"), "horizontal");
});

test("sanitizeTextLayout and sanitizeTextStyle clamp invalid reader fields defensively", () => {
    assert.deepEqual(sanitizeTextLayout({
        lines: ["A", 1, "B"],
        inlineAlign: "center",
        blockAlign: "bad",
        source: "manual",
    }), {
        lines: ["A", "B"],
        inlineAlign: "center",
        source: "manual",
    });

    assert.deepEqual(sanitizeTextStyle({
        fontSizePx: 24,
        fontWeight: 450,
        lineHeight: 1.25,
        letterSpacing: Number.POSITIVE_INFINITY,
        fitMode: "fixed",
    }), {
        fontSizePx: 24,
        lineHeight: 1.25,
        fitMode: "fixed",
    });
});

test("renderTextForLettering uses explicit layout lines before soft-break experiments", () => {
    assert.equal(renderTextForLettering({
        text: "ignored source",
        textLayout: { lines: ["行一", "行二"] },
    }, {
        addJapaneseSoftBreaks: true,
        spaceAsBreak: true,
    }), "行一\n行二");
});

test("resolvedFitMode falls back to auto when shrink or fixed lacks fontSizePx", () => {
    assert.equal(resolvedFitMode(undefined), "auto");
    assert.equal(resolvedFitMode({ fontSizePx: 22 }), "shrink");
    assert.equal(resolvedFitMode({ fitMode: "fixed" }), "auto");
    assert.equal(resolvedFitMode({ fontSizePx: 22, fitMode: "fixed" }), "fixed");
});

test("buildLetteringRender emits Phase 0-compatible style variables", () => {
    const render = buildLetteringRender({
        source: {
            text: "Hello",
            textLayout: {
                lines: ["Hel", "lo"],
                inlineAlign: "center",
                blockAlign: "end",
            },
            textStyle: {
                fontSizePx: 24,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: 1.5,
                fitMode: "fixed",
            },
        },
        bbox: { x: 100, y: 200, width: 300, height: 120 },
        page: { width: 1200, height: 1600 },
        displayDirection: "horizontal",
        addJapaneseSoftBreaks: false,
        spaceAsBreak: false,
    });

    assert.equal(render.text, "Hel\nlo");
    assert.equal(render.fitMode, "fixed");
    assert.equal(render.inlineAlign, "center");
    assert.equal(render.blockAlign, "end");
    assert.equal(render.style.includes("left:8.3333%"), true);
    assert.equal(render.style.includes("top:12.5000%"), true);
    assert.equal(render.style.includes("--overlay-fit:1.0000"), true);
    assert.equal(render.style.includes("--overlay-manual-font-size:2.0000cqw"), true);
    assert.equal(render.style.includes("--overlay-font-weight:700"), true);
    assert.equal(render.style.includes("--overlay-line-height:1.2"), true);
    assert.equal(render.style.includes("--overlay-letter-spacing:0.1250cqw"), true);
});
