import { randomUUID as cryptoRandomUUID } from "node:crypto";
import type { Bubble, Episode, Page } from "./types.js";
import type { PackDraftEntry, PackDraftRecord } from "./pack-draft-types.js";

export type TranslationImportSourceFormat = "json" | "csv";
export type TranslationOrigin = "machine" | "human" | "imported";
export type TranslationImportIssueKind =
    | "unmatched_bubble"
    | "duplicate_bubble"
    | "missing_bubble"
    | "source_text_mismatch"
    | "existing_entry_conflict"
    | "invalid_pack_draft";
export type TranslationImportIssueSeverity = "error" | "warning";

export interface TranslationPackDraftImportEntryInput {
    bubble_id: string;
    text?: string;
    suggested_text?: string;
    source_text?: string;
    current_translation?: string;
    page_id?: string;
    panel_id?: string | null;
    row_number?: number;
    row_ref?: string;
    comment?: string;
    translation_origin?: TranslationOrigin;
    provider?: string;
    model?: string;
    confidence?: number;
    generated_at?: string;
}

export interface TranslationPackDraftImportInput {
    series_id: string;
    episode_id: string;
    lang: string;
    source_format: TranslationImportSourceFormat;
    entries: TranslationPackDraftImportEntryInput[];
    apply?: boolean;
}

export interface TranslationImportIssue {
    kind: TranslationImportIssueKind;
    severity: TranslationImportIssueSeverity;
    bubble_id?: string;
    page_id?: string;
    panel_id?: string | null;
    row_number?: number;
    row_ref?: string;
    message: string;
}

export interface TranslationImportSummary {
    total_canonical_bubbles: number;
    total_import_rows: number;
    matched_rows: number;
    planned_entries: number;
    unmatched_bubbles: number;
    duplicate_bubbles: number;
    missing_bubbles: number;
    existing_entry_conflicts: number;
    error_count: number;
    warning_count: number;
}

export interface TranslationPackDraftImportPlan {
    series_id: string;
    episode_id: string;
    lang: string;
    source_format: TranslationImportSourceFormat;
    can_apply: boolean;
    summary: TranslationImportSummary;
    issues: TranslationImportIssue[];
    planned_entries: PackDraftEntry[];
}

interface CanonicalBubbleRef {
    page: Page;
    bubble: Bubble;
}

function pageIdOf(page: Page): string {
    return page.pageId ?? page.id;
}

function isActiveStatus(status?: string): boolean {
    return status === undefined || status === "active";
}

function normalizeText(value?: string): string {
    return (value ?? "").replace(/\s+/g, " ").trim();
}

function rowLabel(entry: TranslationPackDraftImportEntryInput, index: number): Pick<TranslationImportIssue, "row_number" | "row_ref"> {
    return {
        row_number: entry.row_number ?? index + 1,
        ...(entry.row_ref !== undefined && { row_ref: entry.row_ref }),
    };
}

function draftEntryTargetKey(entry: PackDraftEntry): string | null {
    if (!entry.target.bubble_id) return null;
    return [
        entry.target.series_id,
        entry.target.episode_id ?? "",
        entry.target.page_id ?? "",
        entry.target.panel_id ?? "",
        entry.target.bubble_id,
        entry.lang ?? "",
    ].join("\u0000");
}

function translationOriginMetadata(entry: TranslationPackDraftImportEntryInput): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
        translation_origin: entry.translation_origin ?? "imported",
    };
    if (entry.provider !== undefined) metadata.provider = entry.provider;
    if (entry.model !== undefined) metadata.model = entry.model;
    // Display only: confidence must not become an automatic adoption gate.
    if (entry.confidence !== undefined) metadata.confidence = entry.confidence;
    if (entry.generated_at !== undefined) metadata.generated_at = entry.generated_at;
    return metadata;
}

export function packDraftTranslationTargetKey(
    seriesId: string,
    episodeId: string,
    pageId: string,
    panelId: string | null | undefined,
    bubbleId: string,
    lang: string,
): string {
    return [seriesId, episodeId, pageId, panelId ?? "", bubbleId, lang].join("\u0000");
}

export function buildTranslationPackDraftImportPlan(args: {
    draft: PackDraftRecord;
    episode: Episode;
    input: TranslationPackDraftImportInput;
    importedBy?: string | null;
}): TranslationPackDraftImportPlan {
    const { draft, episode, input, importedBy } = args;
    const issues: TranslationImportIssue[] = [];
    const canonicalByBubbleId = new Map<string, CanonicalBubbleRef>();

    for (const page of episode.pages) {
        if (!isActiveStatus(page.status)) continue;
        for (const bubble of page.bubbles) {
            if (!isActiveStatus(bubble.status)) continue;
            canonicalByBubbleId.set(bubble.bubbleId, { page, bubble });
        }
    }

    if (draft.type !== "TRANSLATION") {
        issues.push({
            kind: "invalid_pack_draft",
            severity: "error",
            message: "Translation imports can only target TRANSLATION pack drafts",
        });
    }
    if (draft.target_series_id && draft.target_series_id !== input.series_id) {
        issues.push({
            kind: "invalid_pack_draft",
            severity: "error",
            message: "Pack draft target_series_id does not match import series_id",
        });
    }
    if (draft.target_episode_id && draft.target_episode_id !== input.episode_id) {
        issues.push({
            kind: "invalid_pack_draft",
            severity: "error",
            message: "Pack draft target_episode_id does not match import episode_id",
        });
    }

    const rowCounts = new Map<string, number>();
    for (const entry of input.entries) {
        rowCounts.set(entry.bubble_id, (rowCounts.get(entry.bubble_id) ?? 0) + 1);
    }

    const seenBubbleIds = new Set<string>();
    const rowErrorIndexes = new Set<number>();
    const existingTargetKeys = new Set(draft.entries.map(draftEntryTargetKey).filter((key): key is string => Boolean(key)));

    input.entries.forEach((entry, index) => {
        const canonical = canonicalByBubbleId.get(entry.bubble_id);
        const issueBase = {
            bubble_id: entry.bubble_id,
            page_id: entry.page_id,
            panel_id: entry.panel_id,
            ...rowLabel(entry, index),
        };

        if ((rowCounts.get(entry.bubble_id) ?? 0) > 1) {
            rowErrorIndexes.add(index);
            issues.push({
                kind: "duplicate_bubble",
                severity: "error",
                ...issueBase,
                message: "Import contains multiple rows for the same bubble_id",
            });
        }

        if (!canonical) {
            rowErrorIndexes.add(index);
            issues.push({
                kind: "unmatched_bubble",
                severity: "error",
                ...issueBase,
                message: "Import row bubble_id does not exist in the target Episode",
            });
            return;
        }

        seenBubbleIds.add(entry.bubble_id);
        const canonicalPageId = pageIdOf(canonical.page);
        const canonicalPanelId = canonical.bubble.panelId ?? null;
        const targetKey = packDraftTranslationTargetKey(
            input.series_id,
            input.episode_id,
            canonicalPageId,
            canonicalPanelId,
            canonical.bubble.bubbleId,
            input.lang,
        );
        if (existingTargetKeys.has(targetKey)) {
            rowErrorIndexes.add(index);
            issues.push({
                kind: "existing_entry_conflict",
                severity: "error",
                bubble_id: canonical.bubble.bubbleId,
                page_id: canonicalPageId,
                panel_id: canonicalPanelId,
                ...rowLabel(entry, index),
                message: "Pack draft already has a translation entry for this bubble_id and lang",
            });
        }

        if (entry.source_text && normalizeText(entry.source_text) !== normalizeText(canonical.bubble.textOriginal)) {
            issues.push({
                kind: "source_text_mismatch",
                severity: "warning",
                bubble_id: canonical.bubble.bubbleId,
                page_id: canonicalPageId,
                panel_id: canonicalPanelId,
                ...rowLabel(entry, index),
                message: "Import source_text differs from canonical Bubble textOriginal",
            });
        }
    });

    for (const [bubbleId, canonical] of canonicalByBubbleId) {
        if (seenBubbleIds.has(bubbleId)) continue;
        issues.push({
            kind: "missing_bubble",
            severity: "warning",
            bubble_id: canonical.bubble.bubbleId,
            page_id: pageIdOf(canonical.page),
            panel_id: canonical.bubble.panelId ?? null,
            message: "Canonical Bubble has no translation import row",
        });
    }

    const planned_entries: PackDraftEntry[] = input.entries.flatMap((entry, index) => {
        if (rowErrorIndexes.has(index)) return [];
        const canonical = canonicalByBubbleId.get(entry.bubble_id);
        if (!canonical) return [];
        const text = entry.text ?? entry.suggested_text;
        if (!text) return [];
        const canonicalPageId = pageIdOf(canonical.page);
        const canonicalPanelId = canonical.bubble.panelId ?? null;
        return [{
            entry_id: `pe_${cryptoRandomUUID()}`,
            source_proposal_id: null,
            target: {
                series_id: input.series_id,
                episode_id: input.episode_id,
                page_id: canonicalPageId,
                panel_id: canonicalPanelId,
                bubble_id: canonical.bubble.bubbleId,
            },
            lang: input.lang,
            original_text: canonical.bubble.textOriginal,
            current_translation: entry.current_translation,
            text,
            note: entry.comment,
            metadata: {
                source: "translation_import",
                source_format: input.source_format,
                ...translationOriginMetadata(entry),
                ...(entry.row_number !== undefined && { row_number: entry.row_number }),
                ...(entry.row_ref !== undefined && { row_ref: entry.row_ref }),
                ...(entry.source_text !== undefined && { imported_source_text: entry.source_text }),
            },
            adopted_at: new Date().toISOString(),
            adopted_by: importedBy ?? null,
        }];
    });

    const errorCount = issues.filter((issue) => issue.severity === "error").length;
    const warningCount = issues.filter((issue) => issue.severity === "warning").length;
    const unmatchedCount = issues.filter((issue) => issue.kind === "unmatched_bubble").length;
    const duplicateCount = issues.filter((issue) => issue.kind === "duplicate_bubble").length;
    const missingCount = issues.filter((issue) => issue.kind === "missing_bubble").length;
    const existingConflictCount = issues.filter((issue) => issue.kind === "existing_entry_conflict").length;
    const matchedRows = input.entries.filter((entry) => canonicalByBubbleId.has(entry.bubble_id)).length;

    return {
        series_id: input.series_id,
        episode_id: input.episode_id,
        lang: input.lang,
        source_format: input.source_format,
        can_apply: errorCount === 0 && planned_entries.length > 0,
        summary: {
            total_canonical_bubbles: canonicalByBubbleId.size,
            total_import_rows: input.entries.length,
            matched_rows: matchedRows,
            planned_entries: planned_entries.length,
            unmatched_bubbles: unmatchedCount,
            duplicate_bubbles: duplicateCount,
            missing_bubbles: missingCount,
            existing_entry_conflicts: existingConflictCount,
            error_count: errorCount,
            warning_count: warningCount,
        },
        issues,
        planned_entries,
    };
}
