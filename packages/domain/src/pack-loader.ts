import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PackManifestSchema } from "@manga/schemas";
import type { PackEntry, PackManifest, PackType } from "./types.js";
import { isSafePathSegment } from "./path-safety.js";

export interface PackListFilters {
    targetSeriesId?: string;
    targetEpisodeId?: string;
    type?: PackType;
    publishedOnly?: boolean;
}

export interface PagePackContext {
    seriesId: string;
    episodeId: string;
    pageId: string;
    panelIds?: readonly string[];
    bubbleIds?: readonly string[];
}

export interface PackReadRepository {
    reload(): void;
    listPacks(filters?: PackListFilters): PackManifest[];
    listPacksForPage(context: PagePackContext): PackManifest[];
}

function packMatchesFilters(pack: PackManifest, filters: PackListFilters): boolean {
    if (filters.publishedOnly && !pack.isPublished) return false;
    if (pack.packClass === "deprecated") return false;
    if (filters.type && pack.type !== filters.type) return false;
    if (filters.targetSeriesId && pack.targetSeriesId && pack.targetSeriesId !== filters.targetSeriesId) return false;
    if (filters.targetEpisodeId && pack.targetEpisodeId && pack.targetEpisodeId !== filters.targetEpisodeId) return false;
    return true;
}

function entryTargetsPage(entry: PackEntry, context: PagePackContext): boolean {
    const target = entry.target;
    if (target.seriesId !== context.seriesId) return false;
    if (target.episodeId && target.episodeId !== context.episodeId) return false;
    if (target.pageId && target.pageId !== context.pageId) return false;
    if (target.panelId && !context.panelIds?.includes(target.panelId)) return false;
    if (target.bubbleId && !context.bubbleIds?.includes(target.bubbleId)) return false;
    return true;
}

export class FilePackRepository implements PackReadRepository {
    private packCache: Map<string, PackManifest> = new Map();
    private loaded = false;
    private validationErrors: string[] = [];

    constructor(private packsDir: string) { }

    getValidationErrors(): readonly string[] {
        return this.validationErrors;
    }

    private ensureLoaded(): void {
        if (this.loaded) return;
        this.loadAll();
        this.loaded = true;
    }

    reload(): void {
        this.loaded = false;
        this.packCache.clear();
        this.validationErrors = [];
    }

    private loadAll(): void {
        this.packCache.clear();
        this.validationErrors = [];
        if (!existsSync(this.packsDir)) return;

        const dirs = readdirSync(this.packsDir, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);

        for (const packDir of dirs) {
            if (!isSafePathSegment(packDir)) {
                this.validationErrors.push(`Unsafe Pack directory name: ${packDir}`);
                continue;
            }

            const packPath = join(this.packsDir, packDir, "pack.json");
            if (!existsSync(packPath)) continue;

            try {
                const rawPack = JSON.parse(readFileSync(packPath, "utf-8"));
                const result = PackManifestSchema.safeParse(rawPack);
                if (!result.success) {
                    this.validationErrors.push(
                        `Pack validation failed for ${packPath}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
                    );
                    continue;
                }
                if (result.data.id !== packDir || !isSafePathSegment(result.data.id)) {
                    this.validationErrors.push(`Pack manifest id must match its safe directory name: ${packPath}`);
                    continue;
                }
                this.packCache.set(result.data.id, result.data);
            } catch (error) {
                this.validationErrors.push(`Pack load failed for ${packPath}: ${(error as Error).message}`);
            }
        }

        if (this.validationErrors.length > 0) {
            console.error(`[pack-loader] ${this.validationErrors.length} validation error(s):`);
            for (const error of this.validationErrors) console.error(error);
        }
    }

    listPacks(filters: PackListFilters = {}): PackManifest[] {
        this.ensureLoaded();
        return [...this.packCache.values()]
            .filter((pack) => packMatchesFilters(pack, filters))
            .sort((a, b) => a.id.localeCompare(b.id));
    }

    listPacksForPage(context: PagePackContext): PackManifest[] {
        return this.listPacks({
            targetSeriesId: context.seriesId,
            targetEpisodeId: context.episodeId,
            publishedOnly: true,
        })
            .map((pack) => ({
                ...pack,
                entries: pack.entries.filter((entry) => entryTargetsPage(entry, context)),
            }))
            .filter((pack) => pack.entries.length > 0);
    }
}

export function createFilePackRepository(packsDir: string): PackReadRepository {
    return new FilePackRepository(packsDir);
}
