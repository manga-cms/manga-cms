import { test } from "node:test";
import assert from "node:assert/strict";
import { TranslationPackDraftImportEntrySchema } from "../src/translation-import.ts";

test("TranslationPackDraftImportEntrySchema accepts optional origin metadata fields", () => {
    const parsed = TranslationPackDraftImportEntrySchema.parse({
        bubble_id: "bubble-1",
        text: "Hello",
        translation_origin: "machine",
        provider: "gemini",
        model: "gemini-2.0-flash",
        confidence: 0.82,
        generated_at: "2026-06-13T00:00:00.000Z",
    });

    assert.equal(parsed.translation_origin, "machine");
    assert.equal(parsed.provider, "gemini");
    assert.equal(parsed.confidence, 0.82);
});

test("TranslationPackDraftImportEntrySchema rejects invalid origin metadata", () => {
    assert.throws(() => TranslationPackDraftImportEntrySchema.parse({
        bubble_id: "bubble-1",
        text: "Hello",
        translation_origin: "automagic",
    }), /Invalid enum value/);

    assert.throws(() => TranslationPackDraftImportEntrySchema.parse({
        bubble_id: "bubble-1",
        text: "Hello",
        confidence: 1.5,
    }), /less than or equal to 1/);
});
