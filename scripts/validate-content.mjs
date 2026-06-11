#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { FileContentRepository, FilePackRepository } from "../packages/domain/dist/index.js";
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
        return { seriesCount: series.length, pageCount: 0, warningCount: 0, errorCount: schemaErrors.length };
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
    return { seriesCount: series.length, pageCount, warningCount, errorCount };
}

function validatePacks(packsDir) {
    const repo = new FilePackRepository(packsDir);
    const packs = repo.listPacks();
    const schemaErrors = repo.getValidationErrors();
    for (const error of schemaErrors) {
        console.error(error);
    }
    return { packCount: packs.length, errorCount: schemaErrors.length };
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
        : { seriesCount: 0, pageCount: 0, warningCount: 0, errorCount: 0 };
    const packResult = packsExists
        ? validatePacks(packsDir)
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
