import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ProposalCreateInput, ProposalKind, ProposalRecord, ProposalStatus } from "./proposal-types.js";
import type { FeedbackIssueType, FeedbackRecord } from "./feedback-types.js";
import { withFileLock } from "./file-lock.js";

export interface ProposalRepository {
    create(input: ProposalCreateInput): ProposalRecord;
    list(filters?: { status?: ProposalStatus; kind?: ProposalKind; seriesId?: string }): ProposalRecord[];
    get(proposalId: string): ProposalRecord | undefined;
    getBySourceFeedbackId(feedbackId: string): ProposalRecord | undefined;
    updateStatus(
        proposalId: string,
        input: { status: ProposalStatus; reviewNote?: string; reviewedBy?: string },
    ): { success: true; record: ProposalRecord } | { success: false; error: string };
}

export class FileProposalRepository implements ProposalRepository {
    constructor(private proposalsDir: string) { }

    private filePath(): string {
        return join(this.proposalsDir, "proposals.jsonl");
    }

    private readAll(): ProposalRecord[] {
        const filePath = this.filePath();
        if (!existsSync(filePath)) return [];
        return readFileSync(filePath, "utf-8")
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .map((line) => JSON.parse(line) as ProposalRecord)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    private writeAll(records: ProposalRecord[]): void {
        mkdirSync(this.proposalsDir, { recursive: true });
        const filePath = this.filePath();
        const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
        writeFileSync(tmpPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf-8");
        renameSync(tmpPath, filePath);
    }

    create(input: ProposalCreateInput): ProposalRecord {
        return withFileLock(this.filePath(), () => {
            mkdirSync(this.proposalsDir, { recursive: true });
            const now = new Date().toISOString();
            const record: ProposalRecord = {
                ...input,
                proposal_id: `pr_${randomUUID()}`,
                status: input.status ?? "new",
                created_at: now,
                updated_at: now,
            };
            appendFileSync(this.filePath(), JSON.stringify(record) + "\n", "utf-8");
            return record;
        });
    }

    list(filters: { status?: ProposalStatus; kind?: ProposalKind; seriesId?: string } = {}): ProposalRecord[] {
        return this.readAll().filter((record) => {
            if (filters.status && record.status !== filters.status) return false;
            if (filters.kind && record.kind !== filters.kind) return false;
            if (filters.seriesId && record.series_id !== filters.seriesId) return false;
            return true;
        });
    }

    get(proposalId: string): ProposalRecord | undefined {
        return this.readAll().find((record) => record.proposal_id === proposalId);
    }

    getBySourceFeedbackId(feedbackId: string): ProposalRecord | undefined {
        return this.readAll().find((record) => record.source_feedback_id === feedbackId);
    }

    updateStatus(
        proposalId: string,
        input: { status: ProposalStatus; reviewNote?: string; reviewedBy?: string },
    ): { success: true; record: ProposalRecord } | { success: false; error: string } {
        return withFileLock(this.filePath(), () => {
            const records = this.readAll();
            const index = records.findIndex((record) => record.proposal_id === proposalId);
            if (index < 0) return { success: false, error: "Proposal not found" };
            const now = new Date().toISOString();
            const record: ProposalRecord = {
                ...records[index]!,
                status: input.status,
                updated_at: now,
                ...(input.reviewNote !== undefined && { review_note: input.reviewNote }),
                ...(input.reviewedBy !== undefined && { reviewed_by: input.reviewedBy }),
                reviewed_at: now,
            };
            records[index] = record;
            this.writeAll(records);
            return { success: true, record };
        });
    }
}

export function createFileProposalRepository(proposalsDir: string): ProposalRepository {
    return new FileProposalRepository(proposalsDir);
}

export function proposalKindFromFeedbackIssue(issueType: FeedbackIssueType): ProposalKind {
    switch (issueType) {
        case "better_translation":
        case "mistranslation":
            return "translation";
        case "typo":
            return "typo";
        case "missing_note":
            return "footnote";
        case "display":
        case "broken_link":
        case "spoiler":
        case "other":
            return "commentary";
    }
}

export function proposalInputFromFeedback(record: FeedbackRecord): ProposalCreateInput {
    return {
        kind: proposalKindFromFeedbackIssue(record.issue_type),
        source_feedback_id: record.feedback_id,
        series_id: record.series_id,
        episode_id: record.episode_id,
        page_id: record.page_id,
        panel_id: record.panel_id,
        bubble_id: record.bubble_id,
        lang: record.lang,
        source_text: record.current_text,
        current_text: record.current_text,
        current_translation: record.current_translation,
        suggested_text: record.suggested_text,
        comment: record.comment,
        proposer_id: record.user_id,
        contributor_identity: record.contributor_identity,
        source_url: record.source_url,
    };
}
