import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withFileLock } from "./file-lock.js";
import type {
    GitHubHandoffSyncAttemptCreateInput,
    GitHubHandoffSyncAttemptRecord,
    GitHubHandoffSyncAttemptStatus,
    GitHubHandoffSyncAttemptStatusUpdateInput,
} from "./github-handoff-sync-attempt-types.js";

const ACTIVE_ATTEMPT_STATUSES: GitHubHandoffSyncAttemptStatus[] = ["planned", "in_progress", "retryable_failed"];

export interface GitHubHandoffSyncAttemptRepository {
    createPlanned(input: GitHubHandoffSyncAttemptCreateInput):
        | { created: true; record: GitHubHandoffSyncAttemptRecord }
        | { created: false; record: GitHubHandoffSyncAttemptRecord };
    list(filters?: {
        status?: GitHubHandoffSyncAttemptStatus;
        targetRepository?: string;
    }): GitHubHandoffSyncAttemptRecord[];
    get(attemptId: string): GitHubHandoffSyncAttemptRecord | undefined;
    updateStatus(
        attemptId: string,
        input: GitHubHandoffSyncAttemptStatusUpdateInput,
    ): { success: true; record: GitHubHandoffSyncAttemptRecord } | { success: false; error: string };
}

function sha256(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}

function createIdempotencyKey(input: GitHubHandoffSyncAttemptCreateInput, draftBodyHash: string): string {
    const source = {
        targetRepository: input.targetRepository,
        targetIssueNumber: input.targetIssueNumber ?? null,
        issueGroupingRule: input.issueGroupingRule ?? null,
        triageGroupKey: input.dryRun.draft.triage_group_key ?? null,
        handoffIds: [...input.dryRun.eligible_handoff_ids].sort(),
        draftBodyHash,
    };
    return `ghsync_${sha256(JSON.stringify(source)).slice(0, 32)}`;
}

export class FileGitHubHandoffSyncAttemptRepository implements GitHubHandoffSyncAttemptRepository {
    constructor(private attemptsDir: string) { }

    private filePath(): string {
        return join(this.attemptsDir, "github-handoff-sync-attempts.jsonl");
    }

    private readAll(): GitHubHandoffSyncAttemptRecord[] {
        const filePath = this.filePath();
        if (!existsSync(filePath)) return [];
        return readFileSync(filePath, "utf-8")
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .map((line) => JSON.parse(line) as GitHubHandoffSyncAttemptRecord)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    private writeAll(records: GitHubHandoffSyncAttemptRecord[]): void {
        mkdirSync(this.attemptsDir, { recursive: true });
        const filePath = this.filePath();
        const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
        writeFileSync(tmpPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf-8");
        renameSync(tmpPath, filePath);
    }

    createPlanned(input: GitHubHandoffSyncAttemptCreateInput):
        | { created: true; record: GitHubHandoffSyncAttemptRecord }
        | { created: false; record: GitHubHandoffSyncAttemptRecord } {
        return withFileLock(this.filePath(), () => {
            const records = this.readAll();
            const draftBodyHash = sha256(input.dryRun.draft.issue_body);
            const idempotencyKey = createIdempotencyKey(input, draftBodyHash);
            const existing = records.find((record) => (
                record.idempotency_key === idempotencyKey
                && ACTIVE_ATTEMPT_STATUSES.includes(record.status)
            ));
            if (existing) return { created: false, record: existing };

            const now = new Date().toISOString();
            const record: GitHubHandoffSyncAttemptRecord = {
                attempt_id: `ghsa_${randomUUID()}`,
                status: "planned",
                handoff_ids: input.dryRun.eligible_handoff_ids,
                selected_statuses: input.dryRun.selected_statuses,
                skipped: input.dryRun.skipped,
                target_repository: input.targetRepository,
                ...(input.targetIssueNumber !== undefined && { target_issue_number: input.targetIssueNumber }),
                ...(input.issueGroupingRule !== undefined && { issue_grouping_rule: input.issueGroupingRule }),
                ...(input.dryRun.draft.triage_group_key !== undefined && { triage_group_key: input.dryRun.draft.triage_group_key }),
                draft: input.dryRun.draft,
                draft_body_hash: draftBodyHash,
                idempotency_key: idempotencyKey,
                dedupe_keys: input.dryRun.deduplication.keys,
                retry_policy: input.dryRun.retry_policy,
                attempt_count: 0,
                max_attempts: input.maxAttempts ?? input.dryRun.retry_policy.max_attempts,
                ...(input.nextRetryAt !== undefined && { next_retry_at: input.nextRetryAt }),
                ...(input.rateLimitResetAt !== undefined && { rate_limit_reset_at: input.rateLimitResetAt }),
                created_at: now,
                updated_at: now,
            };
            records.unshift(record);
            this.writeAll(records);
            return { created: true, record };
        });
    }

    list(filters: {
        status?: GitHubHandoffSyncAttemptStatus;
        targetRepository?: string;
    } = {}): GitHubHandoffSyncAttemptRecord[] {
        return this.readAll().filter((record) => {
            if (filters.status && record.status !== filters.status) return false;
            if (filters.targetRepository && record.target_repository !== filters.targetRepository) return false;
            return true;
        });
    }

    get(attemptId: string): GitHubHandoffSyncAttemptRecord | undefined {
        return this.readAll().find((record) => record.attempt_id === attemptId);
    }

    updateStatus(
        attemptId: string,
        input: GitHubHandoffSyncAttemptStatusUpdateInput,
    ): { success: true; record: GitHubHandoffSyncAttemptRecord } | { success: false; error: string } {
        return withFileLock(this.filePath(), () => {
            const records = this.readAll();
            const index = records.findIndex((record) => record.attempt_id === attemptId);
            if (index < 0) return { success: false, error: "GitHub handoff sync attempt not found" };

            const existing = records[index]!;
            if (input.status === "succeeded" && !input.githubUrl && !existing.github_url) {
                return { success: false, error: "succeeded status requires github_url" };
            }

            const record: GitHubHandoffSyncAttemptRecord = {
                ...existing,
                status: input.status,
                ...(input.attemptCount !== undefined && { attempt_count: input.attemptCount }),
                ...(input.lastError !== undefined && { last_error: input.lastError }),
                ...(input.nextRetryAt !== undefined && { next_retry_at: input.nextRetryAt }),
                ...(input.rateLimitResetAt !== undefined && { rate_limit_reset_at: input.rateLimitResetAt }),
                ...(input.githubUrl !== undefined && { github_url: input.githubUrl }),
                updated_at: new Date().toISOString(),
            };
            records[index] = record;
            this.writeAll(records);
            return { success: true, record };
        });
    }
}

export function createFileGitHubHandoffSyncAttemptRepository(attemptsDir: string): GitHubHandoffSyncAttemptRepository {
    return new FileGitHubHandoffSyncAttemptRepository(attemptsDir);
}
