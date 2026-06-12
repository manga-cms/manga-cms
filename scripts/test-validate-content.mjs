#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    buildSyntheticTranslationPack,
    writeSyntheticContents,
    writePlaceholderPng,
} from "./lib/synthetic-content.mjs";

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

function createSyntheticContent(root, options = {}) {
    const contentsDir = join(root, "contents");
    writeSyntheticContents(contentsDir, {
        idPrefix: "series-a",
        pageWidth: 100,
        pageHeight: 100,
        panelsPerPage: 1,
        bubblesPerPage: 1,
        pageLevelBubbleRatio: 1,
        ...options,
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
    return buildSyntheticTranslationPack({
        packId: "translation-en-series-a",
        target,
    });
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
            pageId: "series-a-ep01-p01",
            bubbleId: "series-a-ep01-p01-bubble-001",
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
            pageId: "series-a-ep01-p01",
            bubbleId: "missing-bubble",
        }));

        assertFail(runValidate(contentsDir, packsDir), "missing pack bubble", /references missing Bubble/);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function testHighResolutionPagePasses() {
    const root = createTempWorkspace();
    try {
        const contentsDir = createSyntheticContent(root, {
            pageWidth: 3000,
            pageHeight: 4500,
            panelsPerPage: 4,
            bubblesPerPage: 8,
            pageLevelBubbleRatio: 0.25,
        });
        assertPass(runValidate(contentsDir, join(root, "missing-packs")), "high-resolution synthetic content");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

function testLargeSyntheticEpisodePasses() {
    const root = createTempWorkspace();
    try {
        const contentsDir = createSyntheticContent(root, {
            pagesPerEpisode: 50,
            panelsPerPage: 6,
            bubblesPerPage: 30,
            pageLevelBubbleRatio: 0.1,
        });
        assertPass(runValidate(contentsDir, join(root, "missing-packs")), "large synthetic episode");
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

async function testPlaceholderPngDimensions() {
    const root = createTempWorkspace();
    try {
        const imagePath = join(root, "placeholder.png");
        writePlaceholderPng(imagePath, 3000, 4500);
        const modulePath = new URL("../packages/ingestion/dist/index.js", import.meta.url);
        const { readImageDimensionsFromFile } = await import(modulePath.href);
        assert.deepEqual(readImageDimensionsFromFile(imagePath), { width: 3000, height: 4500 });
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
execFileSync("pnpm", ["--filter", "@manga/ingestion", "build"], {
    cwd: repoRoot,
    stdio: "inherit",
});

testEmptyContentSkipsPackTargetValidation();
testValidPackTargetPasses();
testMissingPackBubbleFails();
testHighResolutionPagePasses();
testLargeSyntheticEpisodePasses();
await testPlaceholderPngDimensions();

console.log("Content validation script tests passed.");
