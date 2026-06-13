import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTranslationPackDraftImportPlan } from "../dist/translation-import.js";
import type { Episode } from "../src/types.ts";
import type { PackDraftRecord } from "../src/pack-draft-types.ts";

function episode(): Episode {
    return {
        id: "ep01",
        episodeNumber: 1,
        title: "Episode 1",
        publishedAt: "2026-06-13T00:00:00.000Z",
        pages: [{
            pageId: "p01",
            id: "p01",
            stableRef: "p01",
            pageNumber: 1,
            images: {},
            width: 1200,
            height: 1600,
            panels: [],
            bubbles: [{
                bubbleId: "b01",
                id: "b01",
                panelId: null,
                stableRef: "p01-f01",
                bubbleNumber: 1,
                bubbleType: "speech",
                textOriginal: "こんにちは",
                bbox: { x: 100, y: 120, width: 240, height: 120 },
            }],
        }],
    };
}

function draft(): PackDraftRecord {
    return {
        pack_draft_id: "pd_1",
        type: "TRANSLATION",
        title: "English Draft",
        language: "en",
        target_series_id: "series-1",
        target_episode_id: "ep01",
        version: 1,
        status: "draft",
        entries: [],
        created_at: "2026-06-13T00:00:00.000Z",
        updated_at: "2026-06-13T00:00:00.000Z",
    };
}

test("buildTranslationPackDraftImportPlan stores origin metadata on planned entries", () => {
    const plan = buildTranslationPackDraftImportPlan({
        draft: draft(),
        episode: episode(),
        importedBy: "admin-1",
        input: {
            series_id: "series-1",
            episode_id: "ep01",
            lang: "en",
            source_format: "json",
            entries: [{
                bubble_id: "b01",
                text: "Hello",
                translation_origin: "machine",
                provider: "gemini",
                model: "gemini-2.0-flash",
                confidence: 0.82,
                generated_at: "2026-06-13T00:00:00.000Z",
            }],
        },
    });

    assert.equal(plan.summary.planned_entries, 1);
    const metadata = plan.planned_entries[0].metadata as Record<string, unknown>;
    assert.equal(metadata.source, "translation_import");
    assert.equal(metadata.translation_origin, "machine");
    assert.equal(metadata.provider, "gemini");
    assert.equal(metadata.model, "gemini-2.0-flash");
    assert.equal(metadata.confidence, 0.82);
    assert.equal(metadata.generated_at, "2026-06-13T00:00:00.000Z");
});

test("buildTranslationPackDraftImportPlan defaults missing origin to imported", () => {
    const plan = buildTranslationPackDraftImportPlan({
        draft: draft(),
        episode: episode(),
        input: {
            series_id: "series-1",
            episode_id: "ep01",
            lang: "en",
            source_format: "csv",
            entries: [{
                bubble_id: "b01",
                text: "Hello",
            }],
        },
    });

    const metadata = plan.planned_entries[0].metadata as Record<string, unknown>;
    assert.equal(metadata.translation_origin, "imported");
});
