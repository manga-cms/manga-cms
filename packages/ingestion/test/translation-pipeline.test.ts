import test from "node:test";
import assert from "node:assert/strict";
import { TranslationPackDraftImportEntrySchema } from "@manga/schemas";
import {
    buildTranslationPageScript,
    convertValidatedTranslationOutputToImportRows,
    NoopTranslationProvider,
    validateTranslationProviderOutput,
} from "../dist/index.js";
import type { Episode } from "@manga/domain";
import type { TranslationProviderOutput } from "../src/translation/types.ts";

function episode(): Episode {
    return {
        id: "ep01",
        episodeNumber: 1,
        title: "Rain Ruins",
        publishedAt: "2026-06-13T00:00:00.000Z",
        pages: [{
            pageId: "p01",
            id: "p01",
            stableRef: "p01",
            pageNumber: 1,
            images: {},
            width: 1200,
            height: 1600,
            panels: [
                {
                    panelId: "left-panel",
                    id: "left-panel",
                    stableRef: "p01-k02",
                    panelNumber: 2,
                    bbox: { x: 60, y: 40, width: 480, height: 360 },
                    reactionTags: [],
                },
                {
                    panelId: "right-panel",
                    id: "right-panel",
                    stableRef: "p01-k01",
                    displayRef: "p01-k01",
                    panelNumber: 1,
                    bbox: { x: 660, y: 40, width: 480, height: 360 },
                    reactionTags: [],
                },
            ],
            bubbles: [
                {
                    bubbleId: "left-bubble",
                    id: "left-bubble",
                    panelId: "left-panel",
                    stableRef: "p01-k02-f01",
                    bubbleNumber: 2,
                    bubbleType: "speech",
                    textOriginal: "雨はまだ止まない。",
                    bbox: { x: 300, y: 120, width: 180, height: 100 },
                },
                {
                    bubbleId: "right-bubble",
                    id: "right-bubble",
                    panelId: "right-panel",
                    stableRef: "p01-k01-f01",
                    bubbleNumber: 1,
                    bubbleType: "speech",
                    speaker: "Ame",
                    textOriginal: "今日は雨だね",
                    bbox: { x: 900, y: 120, width: 180, height: 100 },
                },
                {
                    bubbleId: "caption-bubble",
                    id: "caption-bubble",
                    panelId: null,
                    stableRef: "p01-f03",
                    bubbleNumber: 3,
                    bubbleType: "caption",
                    textOriginal: "そのころ",
                    bbox: { x: 800, y: 520, width: 220, height: 80 },
                },
            ],
        }],
    };
}

function providerOutput(overrides: Partial<TranslationProviderOutput> = {}): TranslationProviderOutput {
    return {
        providerId: "fixture-provider",
        model: "fixture-model",
        promptVersion: "translation-page-v1",
        generatedAt: "2026-06-13T00:00:00.000Z",
        diagnostics: [],
        translations: [
            { bubbleId: "right-bubble", text: "It is raining today.", confidence: 0.91 },
            { bubbleId: "left-bubble", text: "The rain still has not stopped.", confidence: 0.88 },
            { bubbleId: "caption-bubble", text: "Meanwhile", confidence: 0.74 },
        ],
        ...overrides,
    };
}

test("buildTranslationPageScript emits canonical RTL page script with context notes", () => {
    const source = episode();
    const page = source.pages[0];
    const script = buildTranslationPageScript({
        episode: source,
        page,
        sourceLocale: "ja",
        targetLocale: "en",
        glossary: [{ source: "雨", target: "rain", note: "Keep natural." }],
        characterVoices: [{ speaker: "Ame", note: "Quiet and concise." }],
    });

    assert.deepEqual(script.panelOrder, ["right-panel", "left-panel"]);
    assert.deepEqual(script.bubbleOrder, ["right-bubble", "left-bubble", "caption-bubble"]);
    assert.match(script.text, /bubbleId=right-bubble/);
    assert.match(script.text, /Glossary:/);
    assert.match(script.text, /Character voices:/);
});

test("validateTranslationProviderOutput accepts exact Bubble ID coverage", () => {
    const result = validateTranslationProviderOutput(["right-bubble", "left-bubble"], providerOutput({
        translations: [
            { bubbleId: "right-bubble", text: "Right" },
            { bubbleId: "left-bubble", text: "Left" },
        ],
    }));

    assert.equal(result.canConvert, true);
    assert.equal(result.issues.length, 0);
    assert.equal(result.validTranslations.length, 2);
});

test("validateTranslationProviderOutput reports missing, extra, duplicate, and malformed outputs", () => {
    const result = validateTranslationProviderOutput(["right-bubble", "left-bubble"], providerOutput({
        translations: [
            { bubbleId: "right-bubble", text: "Right" },
            { bubbleId: "right-bubble", text: "Duplicate" },
            { bubbleId: "extra-bubble", text: "Extra" },
            { bubbleId: "", text: "Malformed" },
        ],
    }));

    assert.equal(result.canConvert, false);
    assert.deepEqual(result.issues.map((issue) => issue.kind).sort(), [
        "duplicate_bubble",
        "extra_bubble",
        "malformed_translation",
        "missing_bubble",
    ]);
});

test("convertValidatedTranslationOutputToImportRows creates Phase 1 machine-origin rows", () => {
    const source = episode();
    const script = buildTranslationPageScript({
        episode: source,
        page: source.pages[0],
        sourceLocale: "ja",
        targetLocale: "en",
    });

    const rows = convertValidatedTranslationOutputToImportRows({
        script,
        output: providerOutput(),
    });

    assert.deepEqual(rows.map((row) => row.bubble_id), ["right-bubble", "left-bubble", "caption-bubble"]);
    assert.equal(rows[0]?.translation_origin, "machine");
    assert.equal(rows[0]?.provider, "fixture-provider");
    assert.equal(rows[0]?.model, "fixture-model");
    assert.equal(rows[0]?.generated_at, "2026-06-13T00:00:00.000Z");
    assert.equal(rows[0]?.source_text, "今日は雨だね");
    assert.doesNotThrow(() => rows.forEach((row) => TranslationPackDraftImportEntrySchema.parse(row)));
});

test("convertValidatedTranslationOutputToImportRows refuses invalid provider output", () => {
    const source = episode();
    const script = buildTranslationPageScript({
        episode: source,
        page: source.pages[0],
        targetLocale: "en",
    });

    const rows = convertValidatedTranslationOutputToImportRows({
        script,
        output: providerOutput({
            translations: [{ bubbleId: "right-bubble", text: "Only one" }],
        }),
    });

    assert.deepEqual(rows, []);
});

test("NoopTranslationProvider returns actionable diagnostics without translations", async () => {
    const source = episode();
    const script = buildTranslationPageScript({
        episode: source,
        page: source.pages[0],
        targetLocale: "en",
    });
    const provider = new NoopTranslationProvider();
    const output = await provider.translatePage({ script });

    assert.equal(output.providerId, "noop");
    assert.equal(output.translations.length, 0);
    assert.equal(output.diagnostics[0]?.code, "NOOP_TRANSLATION_PROVIDER");
});
