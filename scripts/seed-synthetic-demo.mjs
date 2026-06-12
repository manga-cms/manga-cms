#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { writeSyntheticContents } from "./lib/synthetic-content.mjs";

const contentsDir = resolve(process.env.CONTENTS_DIR ?? "contents");
const seriesId = "synthetic-demo";

function isIgnorableContentEntry(entry) {
    return entry === ".gitkeep" || entry === ".DS_Store";
}

async function hasExistingContent(dir) {
    try {
        const entries = await readdir(dir);
        return entries.some((entry) => !isIgnorableContentEntry(entry));
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return false;
        }
        throw error;
    }
}

if (await hasExistingContent(contentsDir)) {
    console.log(`Synthetic demo seed skipped: ${contentsDir} already contains content.`);
    process.exit(0);
}

await writeSyntheticContents(contentsDir, {
    idPrefix: seriesId,
    seriesCount: 1,
    episodesPerSeries: 1,
    pagesPerEpisode: 4,
    panelsPerPage: 4,
    bubblesPerPage: 8,
    pageWidth: 1200,
    pageHeight: 1700,
    pageLevelBubbleRatio: 0.125,
    includeImages: true,
});

console.log(`Synthetic demo content written to ${contentsDir}/${seriesId}.`);
