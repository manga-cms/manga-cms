import test from "node:test";
import assert from "node:assert/strict";

import {
    buildImportedBubbleStableRef,
    ImportedBubbleDraftSchema,
    PageImportResultSchema,
} from "../dist/index.js";
import type { ImportedBubbleDraft, PageImportResult } from "@manga/domain";

test("PSD imported bubble draft schema carries reviewable text-layer provenance", () => {
    const bubble: ImportedBubbleDraft = {
        stableRef: "psd-layer:abc123",
        source: "psd_text_layer",
        textOriginal: "今日は雨だね",
        layerName: "bubble-copy",
        groupPath: ["P1", "Panel A"],
        visible: true,
        bbox: { x: 120, y: 80, width: 220, height: 96 },
        bubbleType: "speech",
        speakerConfidence: "unknown",
        sourceLayerId: "42",
    };

    assert.doesNotThrow(() => ImportedBubbleDraftSchema.parse(bubble));
});

test("page import result separates PSD text-layer drafts from canonical content", () => {
    const pageImport: PageImportResult = {
        sourceFile: "imports/storyboard/page-001.psd",
        parser: "@webtoon/psd",
        parserVersion: "0.4.0",
        pageNumber: 1,
        displayRef: "P1",
        width: 768,
        height: 1024,
        bubbles: [
            {
                stableRef: "psd-layer:abc123",
                source: "psd_text_layer",
                textOriginal: "今日は雨だね",
                layerName: "bubble-copy",
                groupPath: ["P1", "Panel A"],
                visible: true,
            },
        ],
        warnings: [],
        unsupported: ["Panel extraction is intentionally not attempted."],
    };

    const parsed = PageImportResultSchema.parse(pageImport);
    assert.equal(parsed.bubbles[0]?.stableRef, "psd-layer:abc123");
    assert.equal("panels" in parsed, false);
});

test("PSD stable refs do not depend on layer traversal index", () => {
    const first = buildImportedBubbleStableRef({
        sourceFile: "imports/storyboard/page-001.psd",
        groupPath: ["P1", "Panel A"],
        layerName: "bubble-copy",
        textOriginal: "今日は雨だね",
        bbox: { x: 120, y: 80, width: 220, height: 96 },
    });
    const afterReorder = buildImportedBubbleStableRef({
        sourceFile: "imports/storyboard/page-001.psd",
        groupPath: ["P1", "Panel A"],
        layerName: "bubble-copy",
        textOriginal: "今日は雨だね",
        bbox: { x: 120, y: 80, width: 220, height: 96 },
    });
    const sourceLayerIdPreferred = buildImportedBubbleStableRef({
        sourceFile: "imports/storyboard/page-001.psd",
        groupPath: ["renamed-group"],
        layerName: "renamed-layer",
        textOriginal: "renamed text",
        bbox: { x: 1, y: 2, width: 3, height: 4 },
        sourceLayerId: "42",
    });
    const sourceLayerIdAfterRename = buildImportedBubbleStableRef({
        sourceFile: "imports/storyboard/page-001.psd",
        groupPath: ["P1", "Panel A"],
        layerName: "bubble-copy",
        textOriginal: "今日は雨だね",
        bbox: { x: 120, y: 80, width: 220, height: 96 },
        sourceLayerId: "42",
    });

    assert.equal(first, afterReorder);
    assert.equal(sourceLayerIdPreferred, sourceLayerIdAfterRename);
    assert.notEqual(first, sourceLayerIdPreferred);
});
