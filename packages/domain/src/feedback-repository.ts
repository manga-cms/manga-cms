import { appendFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { FeedbackPayload, FeedbackRecord } from "./feedback-types.js";

export interface SaveFeedbackInput {
    payload: Omit<FeedbackPayload, "website">;
    clientIp?: string | null;
    userAgent?: string | null;
}

export interface FeedbackRepository {
    save(input: SaveFeedbackInput): FeedbackRecord;
}

export class FileFeedbackRepository implements FeedbackRepository {
    constructor(private feedbackDir: string) { }

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
            join(this.feedbackDir, "feedback.jsonl"),
            JSON.stringify(record) + "\n",
            "utf-8",
        );

        return record;
    }
}

export function createFileFeedbackRepository(feedbackDir: string): FeedbackRepository {
    return new FileFeedbackRepository(feedbackDir);
}
