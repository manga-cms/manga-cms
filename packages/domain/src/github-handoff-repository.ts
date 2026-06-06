import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { isVerifiedGitHubContributor, normalizeContributorIdentity } from "./contributor-identity.js";
import type {
    GitHubHandoffCreateInput,
    GitHubHandoffMode,
    GitHubHandoffRecord,
    GitHubHandoffStatus,
    GitHubHandoffTargetType,
} from "./github-handoff-types.js";
import { isDirectGitHubHandoffMode } from "./github-handoff-types.js";
import { withFileLock } from "./file-lock.js";

export interface GitHubHandoffRepository {
    create(input: GitHubHandoffCreateInput): GitHubHandoffRecord;
    list(filters?: {
        status?: GitHubHandoffStatus;
        targetType?: GitHubHandoffTargetType;
        targetId?: string;
    }): GitHubHandoffRecord[];
    get(handoffId: string): GitHubHandoffRecord | undefined;
    updateStatus(
        handoffId: string,
        input: {
            status: GitHubHandoffStatus;
            githubUrl?: string;
            errorMessage?: string;
        },
    ): { success: true; record: GitHubHandoffRecord } | { success: false; error: string };
}

export function isGitHubHandoffModeAllowed(mode: GitHubHandoffMode, identity?: GitHubHandoffCreateInput["contributor_identity"]): boolean {
    if (!isDirectGitHubHandoffMode(mode)) return true;
    return isVerifiedGitHubContributor(identity);
}

export class FileGitHubHandoffRepository implements GitHubHandoffRepository {
    constructor(private handoffsDir: string) { }

    private filePath(): string {
        return join(this.handoffsDir, "github-handoffs.jsonl");
    }

    private readAll(): GitHubHandoffRecord[] {
        const filePath = this.filePath();
        if (!existsSync(filePath)) return [];
        return readFileSync(filePath, "utf-8")
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .map((line) => JSON.parse(line) as GitHubHandoffRecord)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    private writeAll(records: GitHubHandoffRecord[]): void {
        mkdirSync(this.handoffsDir, { recursive: true });
        const filePath = this.filePath();
        const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
        writeFileSync(tmpPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf-8");
        renameSync(tmpPath, filePath);
    }

    create(input: GitHubHandoffCreateInput): GitHubHandoffRecord {
        return withFileLock(this.filePath(), () => {
            const mode = input.mode ?? "triage_issue_comment";
            const contributorIdentity = normalizeContributorIdentity(input.contributor_identity);
            if (!isGitHubHandoffModeAllowed(mode, contributorIdentity)) {
                throw new Error("Direct GitHub handoff requires verified github_login identity");
            }

            mkdirSync(this.handoffsDir, { recursive: true });
            const now = new Date().toISOString();
            const record: GitHubHandoffRecord = {
                ...input,
                mode,
                contributor_identity: contributorIdentity,
                handoff_id: `ghh_${randomUUID()}`,
                status: "queued",
                created_at: now,
                updated_at: now,
            };
            appendFileSync(this.filePath(), JSON.stringify(record) + "\n", "utf-8");
            return record;
        });
    }

    list(filters: {
        status?: GitHubHandoffStatus;
        targetType?: GitHubHandoffTargetType;
        targetId?: string;
    } = {}): GitHubHandoffRecord[] {
        return this.readAll().filter((record) => {
            if (filters.status && record.status !== filters.status) return false;
            if (filters.targetType && record.target_type !== filters.targetType) return false;
            if (filters.targetId && record.target_id !== filters.targetId) return false;
            return true;
        });
    }

    get(handoffId: string): GitHubHandoffRecord | undefined {
        return this.readAll().find((record) => record.handoff_id === handoffId);
    }

    updateStatus(
        handoffId: string,
        input: {
            status: GitHubHandoffStatus;
            githubUrl?: string;
            errorMessage?: string;
        },
    ): { success: true; record: GitHubHandoffRecord } | { success: false; error: string } {
        return withFileLock(this.filePath(), () => {
            const records = this.readAll();
            const index = records.findIndex((record) => record.handoff_id === handoffId);
            if (index < 0) return { success: false, error: "GitHub handoff not found" };
            const now = new Date().toISOString();
            const record: GitHubHandoffRecord = {
                ...records[index]!,
                status: input.status,
                updated_at: now,
                ...(input.githubUrl !== undefined && { github_url: input.githubUrl }),
                ...(input.errorMessage !== undefined && { error_message: input.errorMessage }),
                ...(input.status === "sent" && { sent_at: now }),
            };
            records[index] = record;
            this.writeAll(records);
            return { success: true, record };
        });
    }
}

export function createFileGitHubHandoffRepository(handoffsDir: string): GitHubHandoffRepository {
    return new FileGitHubHandoffRepository(handoffsDir);
}
