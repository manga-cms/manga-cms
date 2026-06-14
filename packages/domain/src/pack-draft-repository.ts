import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID as cryptoRandomUUID } from "node:crypto";
import { join } from "node:path";
import type { BubbleTextLayout, BubbleTextStyle, PackType } from "./types.js";
import type { PackDraftCreateInput, PackDraftEntry, PackDraftRecord, PackDraftStatus } from "./pack-draft-types.js";
import type { ProposalKind, ProposalRecord } from "./proposal-types.js";
import { withFileLock } from "./file-lock.js";
import { packDraftTranslationTargetKey } from "./translation-import.js";

export interface PackDraftRepository {
    create(input: PackDraftCreateInput): PackDraftRecord;
    list(filters?: { status?: PackDraftStatus; type?: PackType; seriesId?: string }): PackDraftRecord[];
    get(packDraftId: string): PackDraftRecord | undefined;
    updateStatus(
        packDraftId: string,
        input: { status: PackDraftStatus; reviewedBy?: string | null },
    ): { success: true; record: PackDraftRecord } | { success: false; error: string };
    addEntry(
        packDraftId: string,
        entry: PackDraftEntry,
    ): { success: true; record: PackDraftRecord } | { success: false; error: string };
    addEntries(
        packDraftId: string,
        entries: PackDraftEntry[],
    ): { success: true; record: PackDraftRecord } | { success: false; error: string };
    patchEntryLettering(
        packDraftId: string,
        entryId: string,
        input: { textLayout?: BubbleTextLayout; textStyle?: BubbleTextStyle },
    ): { success: true; record: PackDraftRecord; entry: PackDraftEntry } | { success: false; error: string };
}

export class FilePackDraftRepository implements PackDraftRepository {
    constructor(private packDraftsDir: string) { }

    private filePath(): string {
        return join(this.packDraftsDir, "pack-drafts.jsonl");
    }

    private readAll(): PackDraftRecord[] {
        const filePath = this.filePath();
        if (!existsSync(filePath)) return [];
        return readFileSync(filePath, "utf-8")
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .map((line) => JSON.parse(line) as PackDraftRecord)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    private writeAll(records: PackDraftRecord[]): void {
        mkdirSync(this.packDraftsDir, { recursive: true });
        const filePath = this.filePath();
        const tmpPath = `${filePath}.${process.pid}.${cryptoRandomUUID()}.tmp`;
        writeFileSync(tmpPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf-8");
        renameSync(tmpPath, filePath);
    }

    create(input: PackDraftCreateInput): PackDraftRecord {
        return withFileLock(this.filePath(), () => {
            mkdirSync(this.packDraftsDir, { recursive: true });
            const now = new Date().toISOString();
            const record: PackDraftRecord = {
                ...input,
                pack_draft_id: `pd_${cryptoRandomUUID()}`,
                status: "draft",
                version: input.version ?? 1,
                entries: [],
                created_at: now,
                updated_at: now,
            };
            appendFileSync(this.filePath(), JSON.stringify(record) + "\n", "utf-8");
            return record;
        });
    }

    list(filters: { status?: PackDraftStatus; type?: PackType; seriesId?: string } = {}): PackDraftRecord[] {
        return this.readAll().filter((record) => {
            if (filters.status && record.status !== filters.status) return false;
            if (filters.type && record.type !== filters.type) return false;
            if (filters.seriesId && record.target_series_id !== filters.seriesId) return false;
            return true;
        });
    }

    get(packDraftId: string): PackDraftRecord | undefined {
        return this.readAll().find((record) => record.pack_draft_id === packDraftId);
    }

    updateStatus(
        packDraftId: string,
        input: { status: PackDraftStatus; reviewedBy?: string | null },
    ): { success: true; record: PackDraftRecord } | { success: false; error: string } {
        return withFileLock(this.filePath(), () => {
            const records = this.readAll();
            const index = records.findIndex((record) => record.pack_draft_id === packDraftId);
            if (index < 0) return { success: false, error: "Pack draft not found" };
            const now = new Date().toISOString();
            const record: PackDraftRecord = {
                ...records[index]!,
                status: input.status,
                updated_at: now,
                ...(input.reviewedBy !== undefined && { reviewed_by: input.reviewedBy }),
                reviewed_at: now,
            };
            records[index] = record;
            this.writeAll(records);
            return { success: true, record };
        });
    }

    private letteringGuard(entries: PackDraftEntry[]): string | null {
        const blocked = entries.find((entry) => entry.text_layout !== undefined || entry.text_style !== undefined);
        if (!blocked) return null;
        return "Pack Draft lettering fields are not accepted in Phase 0";
    }

    addEntry(
        packDraftId: string,
        entry: PackDraftEntry,
    ): { success: true; record: PackDraftRecord } | { success: false; error: string } {
        return withFileLock(this.filePath(), () => {
            const letteringError = this.letteringGuard([entry]);
            if (letteringError) return { success: false, error: letteringError };
            const records = this.readAll();
            const index = records.findIndex((record) => record.pack_draft_id === packDraftId);
            if (index < 0) return { success: false, error: "Pack draft not found" };
            if (entry.source_proposal_id && records[index]!.entries.some((existing) => existing.source_proposal_id === entry.source_proposal_id)) {
                return { success: false, error: "Proposal already adopted into this pack draft" };
            }
            const record: PackDraftRecord = {
                ...records[index]!,
                entries: [...records[index]!.entries, entry],
                updated_at: new Date().toISOString(),
            };
            records[index] = record;
            this.writeAll(records);
            return { success: true, record };
        });
    }

    addEntries(
        packDraftId: string,
        entries: PackDraftEntry[],
    ): { success: true; record: PackDraftRecord } | { success: false; error: string } {
        return withFileLock(this.filePath(), () => {
            if (entries.length === 0) return { success: false, error: "No pack draft entries to add" };
            const letteringError = this.letteringGuard(entries);
            if (letteringError) return { success: false, error: letteringError };
            const records = this.readAll();
            const index = records.findIndex((record) => record.pack_draft_id === packDraftId);
            if (index < 0) return { success: false, error: "Pack draft not found" };
            const existingKeys = new Set(records[index]!.entries.map((entry) => {
                if (!entry.target.episode_id || !entry.target.page_id || !entry.target.bubble_id || !entry.lang) return null;
                return packDraftTranslationTargetKey(
                    entry.target.series_id,
                    entry.target.episode_id,
                    entry.target.page_id,
                    entry.target.panel_id,
                    entry.target.bubble_id,
                    entry.lang,
                );
            }).filter((key): key is string => Boolean(key)));
            for (const entry of entries) {
                if (!entry.target.episode_id || !entry.target.page_id || !entry.target.bubble_id || !entry.lang) continue;
                const key = packDraftTranslationTargetKey(
                    entry.target.series_id,
                    entry.target.episode_id,
                    entry.target.page_id,
                    entry.target.panel_id,
                    entry.target.bubble_id,
                    entry.lang,
                );
                if (existingKeys.has(key)) {
                    return { success: false, error: "Pack draft already has a translation entry for one or more imported bubbles" };
                }
                existingKeys.add(key);
            }
            const record: PackDraftRecord = {
                ...records[index]!,
                entries: [...records[index]!.entries, ...entries],
                updated_at: new Date().toISOString(),
            };
            records[index] = record;
            this.writeAll(records);
            return { success: true, record };
        });
    }

    patchEntryLettering(
        packDraftId: string,
        entryId: string,
        input: { textLayout?: BubbleTextLayout; textStyle?: BubbleTextStyle },
    ): { success: true; record: PackDraftRecord; entry: PackDraftEntry } | { success: false; error: string } {
        return withFileLock(this.filePath(), () => {
            const records = this.readAll();
            const index = records.findIndex((record) => record.pack_draft_id === packDraftId);
            if (index < 0) return { success: false, error: "Pack draft not found" };
            const entryIndex = records[index]!.entries.findIndex((entry) => entry.entry_id === entryId);
            if (entryIndex < 0) return { success: false, error: "Pack draft entry not found" };
            const entry = { ...records[index]!.entries[entryIndex]! };
            if (input.textLayout !== undefined) {
                if (Object.keys(input.textLayout).length === 0) delete entry.text_layout;
                else entry.text_layout = input.textLayout;
            }
            if (input.textStyle !== undefined) {
                if (Object.keys(input.textStyle).length === 0) delete entry.text_style;
                else entry.text_style = input.textStyle;
            }
            const record: PackDraftRecord = {
                ...records[index]!,
                entries: records[index]!.entries.map((existing, currentIndex) => currentIndex === entryIndex ? entry : existing),
                updated_at: new Date().toISOString(),
            };
            records[index] = record;
            this.writeAll(records);
            return { success: true, record, entry };
        });
    }
}

export function createFilePackDraftRepository(packDraftsDir: string): PackDraftRepository {
    return new FilePackDraftRepository(packDraftsDir);
}

export function packTypesForProposalKind(kind: ProposalKind): PackType[] {
    switch (kind) {
        case "translation":
        case "typo":
            return ["TRANSLATION"];
        case "footnote":
            return ["FOOTNOTE"];
        case "commentary":
            return ["COMMENTARY", "LEARNING"];
        case "tag":
            return ["COMMENTARY", "LEARNING"];
        case "structure":
            return ["ACCESSIBILITY"];
    }
}

export function proposalToPackDraftEntry(
    proposal: ProposalRecord,
    adoptedBy?: string | null,
): PackDraftEntry {
    return {
        entry_id: `pe_${cryptoRandomUUID()}`,
        source_proposal_id: proposal.proposal_id,
        target: {
            series_id: proposal.series_id,
            episode_id: proposal.episode_id,
            page_id: proposal.page_id,
            panel_id: proposal.panel_id,
            bubble_id: proposal.bubble_id,
        },
        lang: proposal.lang,
        original_text: proposal.source_text ?? proposal.current_text,
        current_translation: proposal.current_translation,
        text: proposal.suggested_text,
        note: proposal.comment,
        adopted_at: new Date().toISOString(),
        adopted_by: adoptedBy ?? null,
    };
}
