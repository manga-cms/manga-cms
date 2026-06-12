#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoBlobPrefix = "https://github.com/manga-cms/manga-cms/blob/main/";
const ignoredDirs = new Set([
    ".git",
    ".turbo",
    "node_modules",
    "dist",
    "coverage",
    "tmp",
]);
const checkedExtensions = new Set([".md", ".yml", ".yaml"]);

function walk(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        if (entry.isDirectory()) {
            if (ignoredDirs.has(entry.name)) return [];
            return walk(resolve(dir, entry.name));
        }
        const path = resolve(dir, entry.name);
        return checkedExtensions.has(extname(entry.name).toLowerCase()) ? [path] : [];
    });
}

function repoRelative(path) {
    return path.slice(rootDir.length + 1);
}

function stripAnchorAndQuery(href) {
    return href.split("#")[0].split("?")[0];
}

function normalizeHref(rawHref) {
    let href = rawHref.trim();
    if (href.startsWith("<") && href.endsWith(">")) href = href.slice(1, -1).trim();
    return href;
}

function localTargetForHref(href, sourceFile) {
    const normalized = normalizeHref(href);
    if (!normalized || normalized.startsWith("#")) return null;
    if (normalized.startsWith(repoBlobPrefix)) {
        return resolve(rootDir, decodeURI(stripAnchorAndQuery(normalized.slice(repoBlobPrefix.length))));
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return null;

    const pathOnly = decodeURI(stripAnchorAndQuery(normalized));
    if (!pathOnly) return null;
    if (pathOnly.startsWith("/")) return resolve(rootDir, pathOnly.slice(1));
    return resolve(dirname(sourceFile), pathOnly);
}

function extractLinks(text) {
    const links = [];
    const markdownLinkPattern = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g;
    const repoBlobPattern = /https:\/\/github\.com\/manga-cms\/manga-cms\/blob\/main\/[^\s)"']+/g;

    for (const match of text.matchAll(markdownLinkPattern)) {
        links.push(match[1]);
    }
    for (const match of text.matchAll(repoBlobPattern)) {
        links.push(match[0]);
    }
    return links;
}

const failures = [];

for (const file of walk(rootDir)) {
    const text = readFileSync(file, "utf8");
    for (const href of extractLinks(text)) {
        const target = localTargetForHref(href, file);
        if (!target) continue;
        if (!existsSync(target)) {
            failures.push(`${repoRelative(file)} -> ${href}`);
        } else if (!statSync(target).isFile() && !statSync(target).isDirectory()) {
            failures.push(`${repoRelative(file)} -> ${href}`);
        }
    }
}

if (failures.length > 0) {
    console.error("Broken local documentation links:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
}

console.log("Documentation links passed.");
