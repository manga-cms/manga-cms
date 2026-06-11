#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
    bubbleIdOf,
    FileContentRepository,
    FilePackRepository,
    getPanelBubbles,
    pageIdOf,
    panelIdOf,
} from "../packages/domain/dist/index.js";
import { lintPageContent } from "../packages/schemas/dist/index.js";

function parseArgs(argv) {
    const options = {
        contentsDir: "contents",
        packsDir: "packs",
        failOnWarnings: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--contents") {
            options.contentsDir = argv[++index];
        } else if (arg === "--packs") {
            options.packsDir = argv[++index];
        } else if (arg === "--fail-on-warnings") {
            options.failOnWarnings = true;
        } else if (arg === "--help" || arg === "-h") {
            console.log(`Usage: node scripts/validate-content.mjs [--contents contents] [--packs packs] [--fail-on-warnings]

Validates canonical manga content in contents/ and packs/.
Schema errors and content-lint errors fail the command.
Content-lint warnings are reported but do not fail unless --fail-on-warnings is set.`);
            process.exit(0);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

function printIssue(issue) {
    const location = [
        issue.pageId,
        issue.panelId && `panel=${issue.panelId}`,
        issue.bubbleId && `bubble=${issue.bubbleId}`,
    ].filter(Boolean).join(" ");
    const path = issue.path?.length ? ` path=${issue.path.join(".")}` : "";
    const prefix = location ? `${location} ` : "";
    console.log(`[${issue.severity}] ${issue.code}: ${prefix}${issue.message}${path}`);
}

function validateContents(contentsDir, failOnWarnings) {
    const repo = new FileContentRepository(contentsDir);
    const series = repo.listSeries();
    const schemaErrors = repo.getValidationErrors();

    if (schemaErrors.length > 0) {
        for (const error of schemaErrors) {
            console.error(error.message);
        }
        return {
            series,
            contentIndex: buildContentIndex(series),
            seriesCount: series.length,
            pageCount: 0,
            warningCount: 0,
            errorCount: schemaErrors.length,
        };
    }

    let pageCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (const item of series) {
        for (const episode of item.episodes) {
            for (const page of episode.pages) {
                pageCount += 1;
                const issues = lintPageContent(page);
                for (const issue of issues) {
                    if (issue.severity === "warning") warningCount += 1;
                    else errorCount += 1;
                    printIssue(issue);
                }
            }
        }
    }

    if (failOnWarnings) errorCount += warningCount;
    return {
        series,
        contentIndex: buildContentIndex(series),
        seriesCount: series.length,
        pageCount,
        warningCount,
        errorCount,
    };
}

function key(...segments) {
    return segments.join("\u0000");
}

function setHasPrefix(set, ...prefixSegments) {
    const prefix = `${key(...prefixSegments)}\u0000`;
    for (const value of set) {
        if (value.startsWith(prefix)) return true;
    }
    return false;
}

function setHasParts(set, predicate) {
    for (const value of set) {
        if (predicate(value.split("\u0000"))) return true;
    }
    return false;
}

function buildContentIndex(seriesList) {
    const index = {
        seriesCount: seriesList.length,
        seriesIds: new Set(),
        episodeKeys: new Set(),
        pageKeys: new Set(),
        panelKeys: new Set(),
        panelKeysByEpisode: new Set(),
        bubbleKeys: new Set(),
        bubbleKeysByEpisode: new Set(),
    };

    for (const series of seriesList) {
        index.seriesIds.add(series.id);
        for (const episode of series.episodes ?? []) {
            index.episodeKeys.add(key(series.id, episode.id));
            for (const page of episode.pages ?? []) {
                const pageId = pageIdOf(page);
                index.pageKeys.add(key(series.id, episode.id, pageId));

                for (const panel of page.panels ?? []) {
                    const panelId = panelIdOf(panel);
                    index.panelKeys.add(key(series.id, episode.id, pageId, panelId));
                    index.panelKeysByEpisode.add(key(series.id, episode.id, panelId));
                }

                const pageBubbles = page.bubbles ?? [];
                const legacyPanelBubbles = (page.panels ?? []).flatMap((panel) => getPanelBubbles(page, panel));
                const bubblesById = new Map();
                for (const bubble of [...pageBubbles, ...legacyPanelBubbles]) {
                    bubblesById.set(bubbleIdOf(bubble), bubble);
                }

                for (const bubble of bubblesById.values()) {
                    const bubbleId = bubbleIdOf(bubble);
                    index.bubbleKeys.add(key(series.id, episode.id, pageId, bubbleId));
                    index.bubbleKeysByEpisode.add(key(series.id, episode.id, bubbleId));
                }
            }
        }
    }

    return index;
}

function describePackTarget(target) {
    return [
        target.seriesId,
        target.episodeId,
        target.pageId,
        target.panelId && `panel=${target.panelId}`,
        target.bubbleId && `bubble=${target.bubbleId}`,
    ].filter(Boolean).join(" ");
}

function validatePackTargetReference({ pack, entry, target, contentIndex }) {
    const errors = [];
    const entryLabel = entry ? ` entry=${entry.id}` : "";
    const targetLabel = describePackTarget(target);

    if (!contentIndex.seriesIds.has(target.seriesId)) {
        errors.push(`Pack ${pack.id}${entryLabel} references missing Series: ${target.seriesId}`);
        return errors;
    }

    if (pack.targetSeriesId && target.seriesId !== pack.targetSeriesId) {
        errors.push(
            `Pack ${pack.id}${entryLabel} targets Series ${target.seriesId}, but pack targetSeriesId is ${pack.targetSeriesId}`,
        );
    }

    if (target.episodeId) {
        if (!contentIndex.episodeKeys.has(key(target.seriesId, target.episodeId))) {
            errors.push(`Pack ${pack.id}${entryLabel} references missing Episode: ${target.seriesId}/${target.episodeId}`);
            return errors;
        }
        if (pack.targetEpisodeId && target.episodeId !== pack.targetEpisodeId) {
            errors.push(
                `Pack ${pack.id}${entryLabel} targets Episode ${target.episodeId}, but pack targetEpisodeId is ${pack.targetEpisodeId}`,
            );
        }
    }

    if (target.pageId) {
        if (target.episodeId) {
            if (!contentIndex.pageKeys.has(key(target.seriesId, target.episodeId, target.pageId))) {
                errors.push(`Pack ${pack.id}${entryLabel} references missing Page: ${targetLabel}`);
                return errors;
            }
        } else if (!setHasParts(contentIndex.pageKeys, ([seriesId, _episodeId, pageId]) => (
            seriesId === target.seriesId && pageId === target.pageId
        ))) {
            errors.push(`Pack ${pack.id}${entryLabel} references missing Page without episode scope: ${targetLabel}`);
            return errors;
        }
    }

    if (target.panelId) {
        if (target.episodeId && target.pageId) {
            if (!contentIndex.panelKeys.has(key(target.seriesId, target.episodeId, target.pageId, target.panelId))) {
                errors.push(`Pack ${pack.id}${entryLabel} references missing Panel: ${targetLabel}`);
            }
        } else if (target.episodeId) {
            if (!contentIndex.panelKeysByEpisode.has(key(target.seriesId, target.episodeId, target.panelId))) {
                errors.push(`Pack ${pack.id}${entryLabel} references missing Panel without page scope: ${targetLabel}`);
            }
        } else if (setHasPrefix(contentIndex.panelKeysByEpisode, target.seriesId)) {
            if (!setHasParts(contentIndex.panelKeysByEpisode, ([seriesId, _episodeId, panelId]) => (
                seriesId === target.seriesId && panelId === target.panelId
            ))) {
                errors.push(`Pack ${pack.id}${entryLabel} references missing Panel without episode scope: ${targetLabel}`);
            }
        } else {
            errors.push(`Pack ${pack.id}${entryLabel} references Panel without episode scope: ${targetLabel}`);
        }
    }

    if (target.bubbleId) {
        if (target.episodeId && target.pageId) {
            if (!contentIndex.bubbleKeys.has(key(target.seriesId, target.episodeId, target.pageId, target.bubbleId))) {
                errors.push(`Pack ${pack.id}${entryLabel} references missing Bubble: ${targetLabel}`);
            }
        } else if (target.episodeId) {
            if (!contentIndex.bubbleKeysByEpisode.has(key(target.seriesId, target.episodeId, target.bubbleId))) {
                errors.push(`Pack ${pack.id}${entryLabel} references missing Bubble without page scope: ${targetLabel}`);
            }
        } else if (setHasPrefix(contentIndex.bubbleKeysByEpisode, target.seriesId)) {
            if (!setHasParts(contentIndex.bubbleKeysByEpisode, ([seriesId, _episodeId, bubbleId]) => (
                seriesId === target.seriesId && bubbleId === target.bubbleId
            ))) {
                errors.push(`Pack ${pack.id}${entryLabel} references missing Bubble without episode scope: ${targetLabel}`);
            }
        } else {
            errors.push(`Pack ${pack.id}${entryLabel} references Bubble without episode scope: ${targetLabel}`);
        }
    }

    return errors;
}

function validatePackTargets(packs, contentIndex) {
    if (!contentIndex || contentIndex.seriesCount === 0) {
        if (packs.length > 0) {
            console.log("No content Series found; skipping Pack target existence checks.");
        }
        return 0;
    }

    let errorCount = 0;
    for (const pack of packs) {
        if (pack.targetSeriesId && !contentIndex.seriesIds.has(pack.targetSeriesId)) {
            console.error(`Pack ${pack.id} references missing targetSeriesId: ${pack.targetSeriesId}`);
            errorCount += 1;
        }
        if (pack.targetSeriesId && pack.targetEpisodeId) {
            const episodeKey = key(pack.targetSeriesId, pack.targetEpisodeId);
            if (!contentIndex.episodeKeys.has(episodeKey)) {
                console.error(`Pack ${pack.id} references missing targetEpisodeId: ${pack.targetSeriesId}/${pack.targetEpisodeId}`);
                errorCount += 1;
            }
        }

        for (const entry of pack.entries ?? []) {
            const errors = validatePackTargetReference({
                pack,
                entry,
                target: entry.target,
                contentIndex,
            });
            for (const error of errors) {
                console.error(error);
                errorCount += 1;
            }
        }
    }

    return errorCount;
}

function validatePacks(packsDir, contentIndex) {
    const repo = new FilePackRepository(packsDir);
    const packs = repo.listPacks();
    const schemaErrors = repo.getValidationErrors();
    for (const error of schemaErrors) {
        console.error(error);
    }
    const targetErrorCount = validatePackTargets(packs, contentIndex);
    return { packCount: packs.length, errorCount: schemaErrors.length + targetErrorCount };
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const contentsDir = resolve(options.contentsDir);
    const packsDir = resolve(options.packsDir);

    const contentsExists = existsSync(contentsDir);
    const packsExists = existsSync(packsDir);

    if (!contentsExists) console.log(`No contents directory found at ${contentsDir}; skipping content validation.`);
    if (!packsExists) console.log(`No packs directory found at ${packsDir}; skipping pack validation.`);

    const contentResult = contentsExists
        ? validateContents(contentsDir, options.failOnWarnings)
        : {
            series: [],
            contentIndex: buildContentIndex([]),
            seriesCount: 0,
            pageCount: 0,
            warningCount: 0,
            errorCount: 0,
        };
    const packResult = packsExists
        ? validatePacks(packsDir, contentResult.contentIndex)
        : { packCount: 0, errorCount: 0 };

    console.log(
        `Content validation checked ${contentResult.seriesCount} series, ${contentResult.pageCount} pages, ${packResult.packCount} packs.`,
    );
    console.log(`Content lint warnings: ${contentResult.warningCount}.`);

    const errorCount = contentResult.errorCount + packResult.errorCount;
    if (errorCount > 0) {
        console.error(`Content validation failed with ${errorCount} error(s).`);
        process.exit(1);
    }

    console.log("Content validation passed.");
}

main();
