import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { FeedbackPayload, FeedbackRecord, FeedbackStatus } from "./feedback-types.js";

export interface SaveFeedbackInput {
    payload: Omit<FeedbackPayload, "website">;
    clientIp?: string | null;
    userAgent?: string | null;
}

export interface FeedbackRepository {
    save(input: SaveFeedbackInput): FeedbackRecord;
    list(): FeedbackRecord[];
    get(feedbackId: string): FeedbackRecord | undefined;
    updateStatus(
        feedbackId: string,
        input: { status: FeedbackStatus; triageNote?: string; triagedBy?: string },
    ): { success: true; record: FeedbackRecord } | { success: false; error: string };
}

export class FileFeedbackRepository implements FeedbackRepository {
    constructor(private feedbackDir: string) { }

    private filePath(): string {
        return join(this.feedbackDir, "feedback.jsonl");
    }

    private readAll(): FeedbackRecord[] {
        const filePath = this.filePath();
        if (!existsSync(filePath)) return [];
        return readFileSync(filePath, "utf-8")
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .map((line) => JSON.parse(line) as FeedbackRecord)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    private writeAll(records: FeedbackRecord[]): void {
        mkdirSync(this.feedbackDir, { recursive: true });
        const filePath = this.filePath();
        const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
        writeFileSync(tmpPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf-8");
        renameSync(tmpPath, filePath);
    }

    save(input: SaveFeedbackInput): FeedbackRecord {
        mkdirSync(this.feedbackDir, { recursive: true });

        const now = new Date().toISOString();
        const record: FeedbackRecord = {
            ...input.payload,
            feedback_id: `fb_${randomUUID()}`,
            status: "new",
            created_at: now,
            user_agent: input.payload.user_agent ?? input.userAgent ?? undefined,
            client_ip: input.clientIp ?? null,
        };

        appendFileSync(
            this.filePath(),
            JSON.stringify(record) + "\n",
            "utf-8",
        );

        return record;
    }

    list(): FeedbackRecord[] {
        return this.readAll();
    }

    get(feedbackId: string): FeedbackRecord | undefined {
        return this.readAll().find((record) => record.feedback_id === feedbackId);
    }

    updateStatus(
        feedbackId: string,
        input: { status: FeedbackStatus; triageNote?: string; triagedBy?: string },
    ): { success: true; record: FeedbackRecord } | { success: false; error: string } {
        const records = this.readAll();
        const index = records.findIndex((record) => record.feedback_id === feedbackId);
        if (index < 0) return { success: false, error: "Feedback not found" };
        const record: FeedbackRecord = {
            ...records[index]!,
            status: input.status,
            ...(input.triageNote !== undefined && { triage_note: input.triageNote }),
            ...(input.triagedBy !== undefined && { triaged_by: input.triagedBy }),
            triaged_at: new Date().toISOString(),
        };
        records[index] = record;
        this.writeAll(records);
        return { success: true, record };
    }
}

export function createFileFeedbackRepository(feedbackDir: string): FeedbackRepository {
    return new FileFeedbackRepository(feedbackDir);
}
