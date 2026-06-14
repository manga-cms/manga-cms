import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createFileWriter } from "../dist/content-writer.js";
import { createFilePackDraftRepository } from "../dist/pack-draft-repository.js";
import { createFilePackWriter } from "../dist/pack-writer.js";
import type { SaveEpisodeInput } from "../src/content-writer.ts";
import type { PackDraftEntry } from "../src/pack-draft-types.ts";

function writeSeries(dir: string) {
    const seriesDir = join(dir, "series-1");
    mkdirSync(seriesDir, { recursive: true });
    writeFileSync(join(seriesDir, "series.json"), JSON.stringify({
        id: "series-1",
        title: "Series",
        description: "",
        status: "ongoing",
        cover: "cover.jpg",
        episodes: ["ep01"],
    }, null, 2));
    return seriesDir;
}

function episodeInput(overrides: Partial<SaveEpisodeInput["pages"][number]["bubbles"][number]> = {}): SaveEpisodeInput {
    return {
        id: "ep01",
        episodeNumber: 1,
        title: "Episode 1",
        publishedAt: "2026-06-14T00:00:00.000Z",
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
                stableRef: "b01",
                panelId: null,
                bubbleNumber: 1,
                bubbleType: "speech",
                textOriginal: "こんにちは",
                bbox: { x: 100, y: 120, width: 240, height: 120 },
                ...overrides,
            }],
        }],
    };
}

function packDraftEntry(overrides: Partial<PackDraftEntry> = {}): PackDraftEntry {
    return {
        entry_id: "entry-1",
        target: {
            series_id: "series-1",
            episode_id: "ep01",
            page_id: "p01",
            bubble_id: "b01",
        },
        lang: "en",
        text: "Hello",
        adopted_at: "2026-06-14T00:00:00.000Z",
        ...overrides,
    };
}

test("FileContentWriter strips incoming lettering fields on new full Episode saves", () => {
    const dir = mkdtempSync(join(tmpdir(), "manga-lettering-writer-"));
    try {
        writeSeries(dir);
        const writer = createFileWriter(dir);
        const result = writer.saveEpisode("series-1", episodeInput({
            textLayout: { lines: ["入れない"] },
            textStyle: { fontSizePx: 48, fitMode: "fixed" },
        } as any));
        assert.equal(result.success, true);

        const written = JSON.parse(readFileSync(join(dir, "series-1", "ep01", "episode.json"), "utf-8"));
        assert.equal(written.pages[0].bubbles[0].textLayout, undefined);
        assert.equal(written.pages[0].bubbles[0].textStyle, undefined);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("FileContentWriter preserves existing hand-authored lettering across full Episode saves", () => {
    const dir = mkdtempSync(join(tmpdir(), "manga-lettering-writer-"));
    try {
        const seriesDir = writeSeries(dir);
        const episodeDir = join(seriesDir, "ep01");
        mkdirSync(episodeDir, { recursive: true });
        writeFileSync(join(episodeDir, "episode.json"), JSON.stringify(episodeInput({
            textLayout: { lines: ["既存", "改行"], source: "manual" },
            textStyle: { fontSizePx: 30, fitMode: "fixed" },
        } as any), null, 2));

        const writer = createFileWriter(dir);
        const result = writer.saveEpisode("series-1", episodeInput({
            textOriginal: "変更された本文",
            textLayout: { lines: ["上書き", "しない"] },
            textStyle: { fontSizePx: 99, fitMode: "fixed" },
        } as any));
        assert.equal(result.success, true);

        const written = JSON.parse(readFileSync(join(episodeDir, "episode.json"), "utf-8"));
        assert.deepEqual(written.pages[0].bubbles[0].textLayout, { lines: ["既存", "改行"], source: "manual" });
        assert.deepEqual(written.pages[0].bubbles[0].textStyle, { fontSizePx: 30, fitMode: "fixed" });
        assert.equal(written.pages[0].bubbles[0].textOriginal, "変更された本文");
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("FilePackDraftRepository rejects lettering fields in Phase 0 writes", () => {
    const dir = mkdtempSync(join(tmpdir(), "manga-lettering-pack-draft-"));
    try {
        const repo = createFilePackDraftRepository(dir);
        const draft = repo.create({
            type: "TRANSLATION",
            title: "English",
            language: "en",
            target_series_id: "series-1",
            target_episode_id: "ep01",
        });

        const layoutResult = repo.addEntry(draft.pack_draft_id, packDraftEntry({
            text_layout: { lines: ["Hel", "lo"] },
        }));
        assert.equal(layoutResult.success, false);
        assert.match(layoutResult.success ? "" : layoutResult.error, /lettering fields/);

        const styleResult = repo.addEntries(draft.pack_draft_id, [packDraftEntry({
            entry_id: "entry-2",
            text_style: { fontSizePx: 24, fitMode: "fixed" },
        })]);
        assert.equal(styleResult.success, false);
        assert.match(styleResult.success ? "" : styleResult.error, /lettering fields/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("FilePackDraftRepository applies translation lettering through narrow patch and export", () => {
    const dir = mkdtempSync(join(tmpdir(), "manga-lettering-pack-draft-patch-"));
    try {
        const repo = createFilePackDraftRepository(join(dir, "pack-drafts"));
        const writer = createFilePackWriter(join(dir, "packs"));
        const draft = repo.create({
            type: "TRANSLATION",
            title: "English",
            language: "en",
            target_series_id: "series-1",
            target_episode_id: "ep01",
        });
        const addResult = repo.addEntry(draft.pack_draft_id, packDraftEntry());
        assert.equal(addResult.success, true);

        const patchResult = repo.patchEntryLettering(draft.pack_draft_id, "entry-1", {
            textLayout: { lines: ["Hello", "there"], source: "manual", offsetXPercent: 12.5 },
            textStyle: { fontSizePx: 24, fitMode: "fixed" },
        });
        assert.equal(patchResult.success, true);
        assert.deepEqual(patchResult.success ? patchResult.entry.text_layout : undefined, { lines: ["Hello", "there"], source: "manual", offsetXPercent: 12.5 });
        assert.deepEqual(patchResult.success ? patchResult.entry.text_style : undefined, { fontSizePx: 24, fitMode: "fixed" });

        const statusResult = repo.updateStatus(draft.pack_draft_id, { status: "approved" });
        assert.equal(statusResult.success, true);
        const exportResult = writer.exportDraft({
            draft: statusResult.success ? statusResult.record : draft,
            exportInput: { packId: "translation-en-series-1-ep01", isPublished: true },
        });
        assert.equal(exportResult.success, true);
        assert.deepEqual(exportResult.success ? exportResult.pack.entries[0]?.textLayout : undefined, { lines: ["Hello", "there"], source: "manual", offsetXPercent: 12.5 });
        assert.deepEqual(exportResult.success ? exportResult.pack.entries[0]?.textStyle : undefined, { fontSizePx: 24, fitMode: "fixed" });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
