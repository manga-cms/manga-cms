import { test } from "node:test";
import assert from "node:assert/strict";
import { TranslationBatchRunInputSchema } from "../src/translation-batch.ts";

test("TranslationBatchRunInputSchema accepts explicit bounded page selection", () => {
    const parsed = TranslationBatchRunInputSchema.parse({
        series_id: "series-1",
        episode_id: "ep01",
        lang: "en",
        page_numbers: [1, 2],
        provider_mode: "noop",
    });

    assert.deepEqual(parsed.page_numbers, [1, 2]);
    assert.equal(parsed.provider_mode, "noop");
});

test("TranslationBatchRunInputSchema rejects duplicate or unbounded page requests", () => {
    assert.throws(() => TranslationBatchRunInputSchema.parse({
        series_id: "series-1",
        episode_id: "ep01",
        lang: "en",
        page_numbers: [1, 1],
    }), /must not contain duplicates/);

    assert.throws(() => TranslationBatchRunInputSchema.parse({
        series_id: "series-1",
        episode_id: "ep01",
        lang: "en",
        page_numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    }), /at most 10/);
});
