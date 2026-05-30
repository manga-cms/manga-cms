/**
 * Content writer — writes to contents/ directory.
 *
 * Used by apps/api write endpoints. Writes series.json and episode.json
 * files to the filesystem. Designed to be swappable with a DB-backed
 * or GitHub-sync implementation later.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { SeriesManifestSchema, EpisodeSchema } from "@manga/schemas";
import type { Series, Episode } from "./types.js";
import { isSafePathSegment, isSafeRelativeAssetPath } from "./path-safety.js";

// ---------------------------------------------------------------------------
// Write repository interface
// ---------------------------------------------------------------------------

export interface CreateSeriesInput {
    id: string;
    title: string;
    description?: string;
    status?: "ongoing" | "completed" | "hiatus";
    cover?: string;
    shareImageUrl?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: "public" | "hidden" | "archived";
}

export interface UpdateSeriesInput {
    title?: string;
    description?: string;
    status?: "ongoing" | "completed" | "hiatus";
    cover?: string;
    shareImageUrl?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: "public" | "hidden" | "archived";
}

export interface SaveEpisodeInput {
    id: string;
    episodeNumber: number;
    title: string;
    publishedAt?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: "public" | "hidden" | "archived";
    pages: Episode["pages"];
}

export interface ContentWriteRepository {
    createSeries(input: CreateSeriesInput): { success: true; series: Series } | { success: false; error: string };
    updateSeries(seriesId: string, input: UpdateSeriesInput): { success: true; series: Series } | { success: false; error: string };
    saveEpisode(seriesId: string, input: SaveEpisodeInput): { success: true } | { success: false; error: string };
    /** Re-read contents/ to pick up changes. */
    reload(): void;
}

// ---------------------------------------------------------------------------
// Filesystem implementation
// ---------------------------------------------------------------------------

function writeJsonAtomic(filePath: string, value: unknown): void {
    const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(value, null, 2) + "\n", "utf-8");
    renameSync(tmpPath, filePath);
}

function validateEpisodeAssetPaths(input: SaveEpisodeInput): string | null {
    for (const page of input.pages ?? []) {
        for (const [locale, imagePath] of Object.entries(page.images ?? {})) {
            if (imagePath !== undefined && !isSafeRelativeAssetPath(imagePath)) {
                return `Invalid image path for page ${page.pageNumber} locale "${locale}"`;
            }
        }
    }
    return null;
}

export class FileContentWriter implements ContentWriteRepository {
    constructor(
        private contentsDir: string,
        private onWrite?: () => void,
    ) { }

    createSeries(input: CreateSeriesInput): { success: true; series: Series } | { success: false; error: string } {
        if (!isSafePathSegment(input.id)) {
            return { success: false, error: "Series id must be a safe path segment" };
        }
        if (input.cover !== undefined && !isSafeRelativeAssetPath(input.cover)) {
            return { success: false, error: "Cover must be a safe relative asset path" };
        }

        const seriesDir = join(this.contentsDir, input.id);

        if (existsSync(join(seriesDir, "series.json"))) {
            return { success: false, error: `Series "${input.id}" already exists` };
        }

        const manifest = {
            id: input.id,
            title: input.title,
            description: input.description ?? "",
            status: input.status ?? "ongoing",
            cover: input.cover ?? "cover.jpg",
            ...(input.shareImageUrl !== undefined && { shareImageUrl: input.shareImageUrl }),
            ...(input.publishStartAt !== undefined && { publishStartAt: input.publishStartAt }),
            ...(input.publishEndAt !== undefined && { publishEndAt: input.publishEndAt }),
            ...(input.visibility !== undefined && { visibility: input.visibility }),
            episodes: [],
        };

        // Validate before writing
        const result = SeriesManifestSchema.safeParse(manifest);
        if (!result.success) {
            return { success: false, error: `Validation failed: ${result.error.issues.map(i => i.message).join(", ")}` };
        }

        mkdirSync(seriesDir, { recursive: true });
        writeJsonAtomic(join(seriesDir, "series.json"), manifest);

        this.onWrite?.();

        return {
            success: true,
            series: {
                id: manifest.id,
                title: manifest.title,
                description: manifest.description,
                status: manifest.status,
                coverUrl: manifest.cover,
                shareImageUrl: manifest.shareImageUrl,
                publishStartAt: manifest.publishStartAt,
                publishEndAt: manifest.publishEndAt,
                visibility: manifest.visibility,
                episodes: [],
            },
        };
    }

    updateSeries(seriesId: string, input: UpdateSeriesInput): { success: true; series: Series } | { success: false; error: string } {
        if (!isSafePathSegment(seriesId)) {
            return { success: false, error: "Series id must be a safe path segment" };
        }
        if (input.cover !== undefined && !isSafeRelativeAssetPath(input.cover)) {
            return { success: false, error: "Cover must be a safe relative asset path" };
        }

        const manifestPath = join(this.contentsDir, seriesId, "series.json");

        if (!existsSync(manifestPath)) {
            return { success: false, error: `Series "${seriesId}" not found` };
        }

        const existing = JSON.parse(readFileSync(manifestPath, "utf-8"));
        const updated = {
            ...existing,
            ...(input.title !== undefined && { title: input.title }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.status !== undefined && { status: input.status }),
            ...(input.cover !== undefined && { cover: input.cover }),
            ...(input.shareImageUrl !== undefined && { shareImageUrl: input.shareImageUrl }),
            ...(input.publishStartAt !== undefined && { publishStartAt: input.publishStartAt }),
            ...(input.publishEndAt !== undefined && { publishEndAt: input.publishEndAt }),
            ...(input.visibility !== undefined && { visibility: input.visibility }),
        };

        const result = SeriesManifestSchema.safeParse(updated);
        if (!result.success) {
            return { success: false, error: `Validation failed: ${result.error.issues.map(i => i.message).join(", ")}` };
        }

        writeJsonAtomic(manifestPath, updated);
        this.onWrite?.();

        return {
            success: true,
            series: {
                id: updated.id,
                title: updated.title,
                description: updated.description ?? "",
                status: updated.status ?? "ongoing",
                coverUrl: updated.cover ?? "cover.jpg",
                shareImageUrl: updated.shareImageUrl,
                publishStartAt: updated.publishStartAt,
                publishEndAt: updated.publishEndAt,
                visibility: updated.visibility,
                episodes: [],
            },
        };
    }

    saveEpisode(seriesId: string, input: SaveEpisodeInput): { success: true } | { success: false; error: string } {
        if (!isSafePathSegment(seriesId)) {
            return { success: false, error: "Series id must be a safe path segment" };
        }
        if (!isSafePathSegment(input.id)) {
            return { success: false, error: "Episode id must be a safe path segment" };
        }
        const assetPathError = validateEpisodeAssetPaths(input);
        if (assetPathError) {
            return { success: false, error: assetPathError };
        }

        const seriesDir = join(this.contentsDir, seriesId);
        const manifestPath = join(seriesDir, "series.json");

        if (!existsSync(manifestPath)) {
            return { success: false, error: `Series "${seriesId}" not found` };
        }

        // Validate episode
        const epData = {
            id: input.id,
            episodeNumber: input.episodeNumber,
            title: input.title,
            publishedAt: input.publishedAt ?? new Date().toISOString().split("T")[0],
            ...(input.publishStartAt !== undefined && { publishStartAt: input.publishStartAt }),
            ...(input.publishEndAt !== undefined && { publishEndAt: input.publishEndAt }),
            ...(input.visibility !== undefined && { visibility: input.visibility }),
            pages: input.pages ?? [],
        };

        const epResult = EpisodeSchema.safeParse(epData);
        if (!epResult.success) {
            return { success: false, error: `Episode validation failed: ${epResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
        }

        // Write episode
        const epDir = join(seriesDir, input.id);
        mkdirSync(epDir, { recursive: true });
        writeJsonAtomic(join(epDir, "episode.json"), epData);

        // Update manifest episodes list
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        if (!manifest.episodes.includes(input.id)) {
            manifest.episodes.push(input.id);
            manifest.episodes.sort();
            writeJsonAtomic(manifestPath, manifest);
        }

        this.onWrite?.();
        return { success: true };
    }

    reload(): void {
        this.onWrite?.();
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFileWriter(
    contentsDir: string,
    onWrite?: () => void,
): ContentWriteRepository {
    return new FileContentWriter(contentsDir, onWrite);
}
