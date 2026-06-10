import test from "node:test";
import assert from "node:assert/strict";

import { createSourceTextAdapter, normalizeSourceTextRecords } from "../dist/index.js";

test("CSP text export normalizer turns plain text into ordered source records", () => {
    const records = normalizeSourceTextRecords({
        source: "csp_text_export",
        text: "  first line\n\nsecond line\r\n third line ",
    });

    assert.deepEqual(records.map((record) => record.source), [
        "csp_text_export",
        "csp_text_export",
        "csp_text_export",
    ]);
    assert.deepEqual(records.map((record) => record.text), ["first line", "second line", "third line"]);
    assert.deepEqual(records.map((record) => record.order), [1, 2, 3]);
    assert.equal(records[0]?.id, "csp_text_export:0001");
});

test("PSD text layer normalizer preserves layer provenance without parsing private PSD files", () => {
    const adapter = createSourceTextAdapter("psd_text_layer");
    const records = adapter.normalize({
        lines: [
            {
                text: "Layer text",
                layerName: "speech-copy",
                sourceLayerId: "42",
                order: 3,
            },
        ],
    });

    assert.equal(records.length, 1);
    assert.equal(records[0]?.source, "psd_text_layer");
    assert.equal(records[0]?.id, "psd_text_layer:42");
    assert.equal(records[0]?.layerName, "speech-copy");
    assert.equal(records[0]?.order, 3);
});
