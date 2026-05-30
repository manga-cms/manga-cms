/**
 * Content loader — reads contents/ directory as the source of truth.
 *
 * This module is used by both apps/api and apps/viewer (build-time).
 * It reads JSON files from the filesystem, validates them with
 * @manga/schemas (Zod), and returns typed domain data.
 *
 * When DB is connected, swap to a DB-backed loader that implements
 * the same ContentRepository interface.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SeriesManifestSchema, EpisodeSchema } from "@manga/schemas";
import type { Series, Episode, Page, Panel, Bubble } from "./types.js";
import { isSafePathSegment } from "./path-safety.js";

export type PublicationState = "public" | "hidden" | "archived" | "scheduled" | "expired";

export interface PublicationSchedule {
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: "public" | "hidden" | "archived";
}

function parseScheduleDate(value: string | undefined): number | null {
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
}

export function getPublicationState(
    item: PublicationSchedule,
    now: Date = new Date(),
): PublicationState {
    if (item.visibility === "hidden") return "hidden";
    if (item.visibility === "archived") return "archived";

    const nowMs = now.getTime();
    const startMs = parseScheduleDate(item.publishStartAt);
    if (startMs !== null && nowMs < startMs) return "scheduled";

    const endMs = parseScheduleDate(item.publishEndAt);
    if (endMs !== null && nowMs >= endMs) return "expired";

    return "public";
}

export function isPublicNow(item: PublicationSchedule, now: Date = new Date()): boolean {
    return getPublicationState(item, now) === "public";
}

export function isSeriesAndEpisodePublicNow(series: Series, episode: Episode, now: Date = new Date()): boolean {
    return isPublicNow(series, now) && isPublicNow(episode, now);
}

// ---------------------------------------------------------------------------
// Validation error
// ---------------------------------------------------------------------------

export class ContentValidationError extends Error {
    constructor(
        public readonly filePath: string,
        public readonly zodErrors: unknown,
    ) {
        const summary =
            typeof zodErrors === "object" && zodErrors !== null && "issues" in zodErrors
                ? (zodErrors as { issues: { message: string; path: (string | number)[] }[] }).issues
                    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
                    .join("\n")
                : JSON.stringify(zodErrors);
        super(`Content validation failed for ${filePath}:\n${summary}`);
        this.name = "ContentValidationError";
    }
}

// ---------------------------------------------------------------------------
// ContentRepository interface — swap implementations later
// ---------------------------------------------------------------------------

export interface ContentRepository {
    listSeries(): Series[];
    getSeries(seriesId: string): Series | undefined;
    getEpisode(seriesId: string, episodeId: string): Episode | undefined;
    getAdjacentEpisodes(
        seriesId: string,
        episodeId: string,
    ): { prev: Episode | null; next: Episode | null };
    findBubble(
        seriesId: string,
        episodeId: string,
        pageNumber: number,
        panelNumber: number,
        bubbleNumber: number,
    ): { series: Series; episode: Episode; page: Page; panel: Panel; bubble: Bubble } | undefined;
    findPanels(
        seriesId: string,
        episodeId: string,
        pageNumber: number,
        panelStart: number,
        panelEnd: number,
    ): { series: Series; episode: Episode; page: Page; panels: Panel[] } | undefined;
    findReactionPanels(tag: string): {
        series: Series;
        episode: Episode;
        page: Page;
        panel: Panel;
    }[];
}

// ---------------------------------------------------------------------------
// Filesystem-based implementation — with Zod validation
// ---------------------------------------------------------------------------

export class FileContentRepository implements ContentRepository {
    private seriesCache: Map<string, Series> = new Map();
    private loaded = false;
    private validationErrors: ContentValidationError[] = [];

    constructor(private contentsDir: string) { }

    /** Returns any validation errors encountered during loading. */
    getValidationErrors(): readonly ContentValidationError[] {
        return this.validationErrors;
    }

    private ensureLoaded(): void {
        if (this.loaded) return;
        this.loadAll();
        this.loaded = true;
    }

    private loadAll(): void {
        if (!existsSync(this.contentsDir)) return;

        const dirs = readdirSync(this.contentsDir, { withFileTypes: true })
            .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
            .map((d: { name: string }) => d.name);

        for (const seriesDir of dirs) {
            if (!isSafePathSegment(seriesDir)) {
                this.validationErrors.push(
                    new ContentValidationError(seriesDir, "Unsafe series directory name"),
                );
                continue;
            }

            const manifestPath = join(this.contentsDir, seriesDir, "series.json");
            if (!existsSync(manifestPath)) continue;

            // Validate series manifest
            const rawManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
            const manifestResult = SeriesManifestSchema.safeParse(rawManifest);
            if (!manifestResult.success) {
                this.validationErrors.push(
                    new ContentValidationError(manifestPath, manifestResult.error),
                );
                continue; // Skip this series — don't crash
            }
            const manifest = manifestResult.data;
            if (manifest.id !== seriesDir || !isSafePathSegment(manifest.id)) {
                this.validationErrors.push(
                    new ContentValidationError(manifestPath, "Series manifest id must match its safe directory name"),
                );
                continue;
            }

            const episodes: Episode[] = [];
            for (const epId of manifest.episodes) {
                if (!isSafePathSegment(epId)) {
                    this.validationErrors.push(
                        new ContentValidationError(manifestPath, `Unsafe episode id in manifest: ${epId}`),
                    );
                    continue;
                }

                const epPath = join(this.contentsDir, seriesDir, epId, "episode.json");
                if (!existsSync(epPath)) continue;

                // Validate episode data
                const rawEp = JSON.parse(readFileSync(epPath, "utf-8"));
                const epResult = EpisodeSchema.safeParse(rawEp);
                if (!epResult.success) {
                    this.validationErrors.push(
                        new ContentValidationError(epPath, epResult.error),
                    );
                    continue; // Skip this episode
                }
                const epData = epResult.data;

                episodes.push({
                    id: epData.id,
                    episodeNumber: epData.episodeNumber,
                    title: epData.title,
                    publishedAt: epData.publishedAt,
                    publishStartAt: epData.publishStartAt,
                    publishEndAt: epData.publishEndAt,
                    visibility: epData.visibility,
                    pages: epData.pages as Page[],
                });
            }

            const series: Series = {
                id: manifest.id,
                title: manifest.title,
                description: manifest.description,
                status: manifest.status,
                coverUrl: manifest.cover,
                shareImageUrl: manifest.shareImageUrl,
                publishStartAt: manifest.publishStartAt,
                publishEndAt: manifest.publishEndAt,
                visibility: manifest.visibility,
                episodes,
            };

            this.seriesCache.set(series.id, series);
        }

        // Log validation errors to stderr (visible in dev, doesn't crash)
        if (this.validationErrors.length > 0) {
            console.error(
                `[content-loader] ${this.validationErrors.length} validation error(s):`,
            );
            for (const err of this.validationErrors) {
                console.error(err.message);
            }
        }
    }

    listSeries(): Series[] {
        this.ensureLoaded();
        return [...this.seriesCache.values()];
    }

    getSeries(seriesId: string): Series | undefined {
        this.ensureLoaded();
        return this.seriesCache.get(seriesId);
    }

    getEpisode(seriesId: string, episodeId: string): Episode | undefined {
        return this.getSeries(seriesId)?.episodes.find((e) => e.id === episodeId);
    }

    getAdjacentEpisodes(
        seriesId: string,
        episodeId: string,
    ): { prev: Episode | null; next: Episode | null } {
        const s = this.getSeries(seriesId);
        if (!s) return { prev: null, next: null };
        const sorted = [...s.episodes].sort(
            (a, b) => a.episodeNumber - b.episodeNumber,
        );
        const idx = sorted.findIndex((e) => e.id === episodeId);
        return {
            prev: idx > 0 ? sorted[idx - 1] : null,
            next: idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null,
        };
    }

    findBubble(
        seriesId: string,
        episodeId: string,
        pageNumber: number,
        panelNumber: number,
        bubbleNumber: number,
    ) {
        const s = this.getSeries(seriesId);
        if (!s) return undefined;
        const ep = s.episodes.find((e) => e.id === episodeId);
        if (!ep) return undefined;
        const page = ep.pages.find((p) => p.pageNumber === pageNumber);
        if (!page) return undefined;
        const panel = page.panels.find((p) => p.panelNumber === panelNumber);
        if (!panel) return undefined;
        const bubble = panel.bubbles.find((b) => b.bubbleNumber === bubbleNumber);
        if (!bubble) return undefined;
        return { series: s, episode: ep, page, panel, bubble };
    }

    findPanels(
        seriesId: string,
        episodeId: string,
        pageNumber: number,
        panelStart: number,
        panelEnd: number,
    ) {
        const s = this.getSeries(seriesId);
        if (!s) return undefined;
        const ep = s.episodes.find((e) => e.id === episodeId);
        if (!ep) return undefined;
        const page = ep.pages.find((p) => p.pageNumber === pageNumber);
        if (!page) return undefined;
        const panels = page.panels.filter(
            (p) => p.panelNumber >= panelStart && p.panelNumber <= panelEnd,
        );
        if (panels.length === 0) return undefined;
        return { series: s, episode: ep, page, panels };
    }

    findReactionPanels(tag: string) {
        this.ensureLoaded();
        const results: { series: Series; episode: Episode; page: Page; panel: Panel }[] = [];
        for (const s of this.seriesCache.values()) {
            for (const ep of s.episodes) {
                for (const page of ep.pages) {
                    for (const panel of page.panels) {
                        if (panel.reactionTags.includes(tag)) {
                            results.push({ series: s, episode: ep, page, panel });
                        }
                    }
                }
            }
        }
        return results;
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a content repository backed by the filesystem. */
export function createFileRepository(contentsDir: string): ContentRepository {
    return new FileContentRepository(contentsDir);
}
