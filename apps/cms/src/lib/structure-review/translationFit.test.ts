import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateTranslationFit } from "./translationFit.ts";

test("estimateTranslationFit returns ok when text fits rough bbox capacity", () => {
    const result = estimateTranslationFit({
        text: "Short text",
        bbox: { x: 0, y: 0, width: 220, height: 120 },
        textDirection: "horizontal",
    });

    assert.equal(result.status, "ok");
    assert.ok(result.estimatedCapacity > result.characterCount);
});

test("estimateTranslationFit warns when text exceeds rough bbox capacity", () => {
    const result = estimateTranslationFit({
        text: "This translation is intentionally very long and should exceed a tiny speech bubble.",
        bbox: { x: 0, y: 0, width: 48, height: 36 },
        textDirection: "horizontal",
    });

    assert.equal(result.status, "warning");
    assert.ok(result.ratio > 1);
});

test("estimateTranslationFit treats whitespace as layout-neutral for character count", () => {
    const compact = estimateTranslationFit({
        text: "abc",
        bbox: { x: 0, y: 0, width: 120, height: 120 },
    });
    const spaced = estimateTranslationFit({
        text: "a b\nc",
        bbox: { x: 0, y: 0, width: 120, height: 120 },
    });

    assert.equal(spaced.characterCount, compact.characterCount);
});
