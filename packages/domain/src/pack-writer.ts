import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { PackManifestSchema } from "@manga/schemas";
import type { PackClass, PackManifest } from "./types.js";
import type { PackDraftRecord } from "./pack-draft-types.js";
import { isSafePathSegment } from "./path-safety.js";

export interface ExportPackDraftInput {
    packId: string;
    packClass?: PackClass;
    title?: string;
    authorLabel?: string;
    isPublished?: boolean;
    overwrite?: boolean;
}

export interface PackWriteRepository {
    exportDraft(input: { draft: PackDraftRecord; exportInput: ExportPackDraftInput }):
        | { success: true; pack: PackManifest; path: string }
        | { success: false; error: string };
}

function writeJsonAtomic(filePath: string, value: unknown): void {
    const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(value, null, 2) + "\n", "utf-8");
    renameSync(tmpPath, filePath);
}

function draftEntryToPackEntry(entry: PackDraftRecord["entries"][number]): PackManifest["entries"][number] {
    return {
        id: entry.entry_id,
        target: {
            seriesId: entry.target.series_id,
            ...(entry.target.episode_id && { episodeId: entry.target.episode_id }),
            ...(entry.target.page_id && { pageId: entry.target.page_id }),
            ...(entry.target.panel_id && { panelId: entry.target.panel_id }),
            ...(entry.target.bubble_id && { bubbleId: entry.target.bubble_id }),
        },
        ...(entry.lang && { language: entry.lang }),
        ...(entry.original_text && { originalText: entry.original_text }),
        ...(entry.text && { text: entry.text }),
        ...(entry.note && { note: entry.note }),
        ...(entry.source_proposal_id && { sourceProposalId: entry.source_proposal_id }),
        ...(entry.metadata && { metadata: entry.metadata }),
    };
}

export class FilePackWriter implements PackWriteRepository {
    constructor(private packsDir: string) { }

    exportDraft(input: { draft: PackDraftRecord; exportInput: ExportPackDraftInput }):
        | { success: true; pack: PackManifest; path: string }
        | { success: false; error: string } {
        const { draft, exportInput } = input;
        if (!isSafePathSegment(exportInput.packId)) {
            return { success: false, error: "Pack id must be a safe path segment" };
        }
        if (!["approved", "published"].includes(draft.status)) {
            return { success: false, error: "Only approved or published pack drafts can be exported" };
        }
        if (draft.entries.length === 0) {
            return { success: false, error: "Pack draft must have at least one entry before export" };
        }

        const packDir = join(this.packsDir, exportInput.packId);
        const packPath = join(packDir, "pack.json");
        if (existsSync(packPath) && !exportInput.overwrite) {
            return { success: false, error: `Pack "${exportInput.packId}" already exists` };
        }

        const pack: PackManifest = {
            id: exportInput.packId,
            type: draft.type,
            packClass: exportInput.packClass ?? (exportInput.isPublished ? "official" : "draft"),
            ...(draft.language && { language: draft.language }),
            version: draft.version,
            title: exportInput.title ?? draft.title,
            ...(exportInput.authorLabel && { authorLabel: exportInput.authorLabel }),
            isPublished: exportInput.isPublished ?? false,
            ...(draft.target_series_id && { targetSeriesId: draft.target_series_id }),
            ...(draft.target_episode_id && { targetEpisodeId: draft.target_episode_id }),
            sourcePackDraftId: draft.pack_draft_id,
            entries: draft.entries.map(draftEntryToPackEntry),
        };

        const result = PackManifestSchema.safeParse(pack);
        if (!result.success) {
            return { success: false, error: `Pack validation failed: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
        }

        mkdirSync(packDir, { recursive: true });
        writeJsonAtomic(packPath, pack);
        return { success: true, pack, path: packPath };
    }
}

export function createFilePackWriter(packsDir: string): PackWriteRepository {
    return new FilePackWriter(packsDir);
}
