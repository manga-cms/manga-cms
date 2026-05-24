/**
 * Content writer — writes to contents/ directory.
 *
 * Used by apps/api write endpoints. Writes series.json and episode.json
 * files to the filesystem. Designed to be swappable with a DB-backed
 * or GitHub-sync implementation later.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SeriesManifestSchema, EpisodeSchema } from "@manga/schemas";
import type { Series, Episode } from "./types.js";

// ---------------------------------------------------------------------------
// Write repository interface
// ---------------------------------------------------------------------------

export interface CreateSeriesInput {
    id: string;
    title: string;
    description?: string;
    status?: "ongoing" | "completed" | "hiatus";
    cover?: string;
}

export interface UpdateSeriesInput {
    title?: string;
    description?: string;
    status?: "ongoing" | "completed" | "hiatus";
    cover?: string;
}

export interface SaveEpisodeInput {
    id: string;
    episodeNumber: number;
    title: string;
    publishedAt?: string;
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

export class FileContentWriter implements ContentWriteRepository {
    constructor(
        private contentsDir: string,
        private onWrite?: () => void,
    ) { }

    createSeries(input: CreateSeriesInput): { success: true; series: Series } | { success: false; error: string } {
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
            episodes: [],
        };

        // Validate before writing
        const result = SeriesManifestSchema.safeParse(manifest);
        if (!result.success) {
            return { success: false, error: `Validation failed: ${result.error.issues.map(i => i.message).join(", ")}` };
        }

        mkdirSync(seriesDir, { recursive: true });
        writeFileSync(
            join(seriesDir, "series.json"),
            JSON.stringify(manifest, null, 2) + "\n",
            "utf-8",
        );

        this.onWrite?.();

        return {
            success: true,
            series: {
                id: manifest.id,
                title: manifest.title,
                description: manifest.description,
                status: manifest.status,
                coverUrl: manifest.cover,
                episodes: [],
            },
        };
    }

    updateSeries(seriesId: string, input: UpdateSeriesInput): { success: true; series: Series } | { success: false; error: string } {
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
        };

        const result = SeriesManifestSchema.safeParse(updated);
        if (!result.success) {
            return { success: false, error: `Validation failed: ${result.error.issues.map(i => i.message).join(", ")}` };
        }

        writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
        this.onWrite?.();

        return {
            success: true,
            series: {
                id: updated.id,
                title: updated.title,
                description: updated.description ?? "",
                status: updated.status ?? "ongoing",
                coverUrl: updated.cover ?? "cover.jpg",
                episodes: [],
            },
        };
    }

    saveEpisode(seriesId: string, input: SaveEpisodeInput): { success: true } | { success: false; error: string } {
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
            pages: input.pages ?? [],
        };

        const epResult = EpisodeSchema.safeParse(epData);
        if (!epResult.success) {
            return { success: false, error: `Episode validation failed: ${epResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
        }

        // Write episode
        const epDir = join(seriesDir, input.id);
        mkdirSync(epDir, { recursive: true });
        writeFileSync(
            join(epDir, "episode.json"),
            JSON.stringify(epData, null, 2) + "\n",
            "utf-8",
        );

        // Update manifest episodes list
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        if (!manifest.episodes.includes(input.id)) {
            manifest.episodes.push(input.id);
            manifest.episodes.sort();
            writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
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
