#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;

function writeJson(path, value) {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function runValidate(contentsDir, packsDir) {
    return spawnSync(process.execPath, [
        "scripts/validate-content.mjs",
        "--contents",
        contentsDir,
        "--packs",
        packsDir,
    ], {
        cwd: repoRoot,
        encoding: "utf8",
    });
}

function createTempWorkspace() {
    return mkdtempSync(join(tmpdir(), "manga-content-validation-"));
}

function createSyntheticContent(root) {
    const contentsDir = join(root, "contents");
    const seriesDir = join(contentsDir, "series-a");
    const episodeDir = join(seriesDir, "ep01");
    mkdirSync(episodeDir, { recursive: true });

    writeJson(join(seriesDir, "series.json"), {
        id: "series-a",
        title: "Series A",
        description: "Synthetic fixture",
        status: "ongoing",
        episodes: ["ep01"],
    });
    writeJson(join(episodeDir, "episode.json"), {
        schemaVersion: 2,
        id: "ep01",
        episodeNumber: 1,
        title: "Episode 1",
        publishedAt: "2026-01-01T00:00:00.000Z",
        pages: [
            {
                pageId: "page-1",
                pageNumber: 1,
                images: {
                    ja: "/synthetic/page-1.png",
                },
                width: 100,
                height: 100,
                panels: [
                    {
                        panelId: "panel-1",
                        panelNumber: 1,
                        bbox: {
                            x: 0,
                            y: 0,
                            width: 100,
                            height: 100,
                        },
                        reactionTags: [],
                    },
                ],
                bubbles: [
                    {
                        bubbleId: "bubble-1",
                        panelId: null,
                        bubbleNumber: 1,
                        bubbleType: "speech",
                        textOriginal: "Synthetic text",
                        bbox: {
                            x: 10,
                            y: 10,
                            width: 30,
                            height: 20,
                        },
                    },
                ],
            },
        ],
    });

    return contentsDir;
}

function createPack(root, pack) {
    const packsDir = join(root, "packs");
    const packDir = join(packsDir, pack.id);
    mkdirSync(packDir, { recursive: true });
    writeJson(join(packDir, "pack.json"), pack);
    return packsDir;
}

function packWithTarget(target) {
    return {
        id: "translation-en-series-a",
        type: "TRANSLATION",
        language: "en",
        version: 1,
        title: "Synthetic translation",
        isPublished: false,
        targetSeriesId: "series-a",
        targetEpisodeId: "ep01",
        entries: [
            {
                id: "entry-1",
                target,
                language: "en",
                text: "Synthetic translation",
            },
        ],
    };
}

function assertPass(result, label) {
    assert.equal(
        result.status,
        0,
        `${label} expected exit 0\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
}

function assertFail(result, label, expectedText) {
    assert.notEqual(
        result.status,
        0,
        `${label} expected non-zero exit\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
    const output = `${result.stdout}\n${result.stderr}`;
    assert.match(output, expectedText, `${label} expected output to match ${expectedText}\n${output}`);
}

function testEmptyContentSkipsPackTargetValidation() {
    const root = createTempWorkspace();
    try {
        const contentsDir = join(root, "contents");
        mkdirSync(contentsDir, { recursive: true });
        const packsDir = createPack(root, {
            id: "translation-en-missing",
            type: "TRANSLATION",
            language: "en",
            version: 1,
            isPublished: false,
            targetSeriesId: "missing-series",
            entries: [],
        });

        const result = runValidate(contentsDir, packsDir);
        assertPass(result, "empty content skip");
        assert.match(result.stdout, /No content Series found; skipping Pack target existence checks\./);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function testValidPackTargetPasses() {
    const root = createTempWorkspace();
    try {
        const contentsDir = createSyntheticContent(root);
        const packsDir = createPack(root, packWithTarget({
            seriesId: "series-a",
            episodeId: "ep01",
            pageId: "page-1",
            bubbleId: "bubble-1",
        }));

        assertPass(runValidate(contentsDir, packsDir), "valid pack target");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function testMissingPackBubbleFails() {
    const root = createTempWorkspace();
    try {
        const contentsDir = createSyntheticContent(root);
        const packsDir = createPack(root, packWithTarget({
            seriesId: "series-a",
            episodeId: "ep01",
            pageId: "page-1",
            bubbleId: "missing-bubble",
        }));

        assertFail(runValidate(contentsDir, packsDir), "missing pack bubble", /references missing Bubble/);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

execFileSync("pnpm", ["--filter", "@manga/domain", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
});
execFileSync("pnpm", ["--filter", "@manga/schemas", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
});

testEmptyContentSkipsPackTargetValidation();
testValidPackTargetPasses();
testMissingPackBubbleFails();

console.log("Content validation script tests passed.");
