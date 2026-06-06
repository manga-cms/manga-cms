import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type {
    GitHubIdentityVerificationCreateInput,
    GitHubIdentityVerificationRecord,
    GitHubIdentityVerificationStatus,
} from "./github-identity-verification-types.js";
import { withFileLock } from "./file-lock.js";

export interface GitHubIdentityVerificationRepository {
    create(input: GitHubIdentityVerificationCreateInput): GitHubIdentityVerificationRecord;
    list(filters?: {
        status?: GitHubIdentityVerificationStatus;
        githubLogin?: string;
        subjectUserId?: string;
    }): GitHubIdentityVerificationRecord[];
    get(verificationId: string): GitHubIdentityVerificationRecord | undefined;
    revoke(
        verificationId: string,
        input?: { revokedBy?: string | null; revokeNote?: string },
    ): { success: true; record: GitHubIdentityVerificationRecord } | { success: false; error: string };
}

function normalizeGitHubLogin(login: string): string {
    return login.trim();
}

export class FileGitHubIdentityVerificationRepository implements GitHubIdentityVerificationRepository {
    constructor(private identitiesDir: string) { }

    private filePath(): string {
        return join(this.identitiesDir, "github-identity-verifications.jsonl");
    }

    private readAll(): GitHubIdentityVerificationRecord[] {
        const filePath = this.filePath();
        if (!existsSync(filePath)) return [];
        return readFileSync(filePath, "utf-8")
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .map((line) => JSON.parse(line) as GitHubIdentityVerificationRecord)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    private writeAll(records: GitHubIdentityVerificationRecord[]): void {
        mkdirSync(this.identitiesDir, { recursive: true });
        const filePath = this.filePath();
        const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
        writeFileSync(tmpPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf-8");
        renameSync(tmpPath, filePath);
    }

    create(input: GitHubIdentityVerificationCreateInput): GitHubIdentityVerificationRecord {
        return withFileLock(this.filePath(), () => {
            mkdirSync(this.identitiesDir, { recursive: true });
            const now = new Date().toISOString();
            const githubLogin = normalizeGitHubLogin(input.github_login);
            const record: GitHubIdentityVerificationRecord = {
                ...input,
                github_login: githubLogin,
                verification_id: `giv_${randomUUID()}`,
                status: "active",
                contributor_identity: {
                    identity_level: "github_login",
                    github_login: githubLogin,
                    ...(input.github_user_id !== undefined && { github_user_id: input.github_user_id }),
                    verified: true,
                },
                created_at: now,
                updated_at: now,
                verified_at: now,
            };
            appendFileSync(this.filePath(), JSON.stringify(record) + "\n", "utf-8");
            return record;
        });
    }

    list(filters: {
        status?: GitHubIdentityVerificationStatus;
        githubLogin?: string;
        subjectUserId?: string;
    } = {}): GitHubIdentityVerificationRecord[] {
        const githubLogin = filters.githubLogin ? normalizeGitHubLogin(filters.githubLogin).toLowerCase() : undefined;
        return this.readAll().filter((record) => {
            if (filters.status && record.status !== filters.status) return false;
            if (githubLogin && record.github_login.toLowerCase() !== githubLogin) return false;
            if (filters.subjectUserId && record.subject_user_id !== filters.subjectUserId) return false;
            return true;
        });
    }

    get(verificationId: string): GitHubIdentityVerificationRecord | undefined {
        return this.readAll().find((record) => record.verification_id === verificationId);
    }

    revoke(
        verificationId: string,
        input: { revokedBy?: string | null; revokeNote?: string } = {},
    ): { success: true; record: GitHubIdentityVerificationRecord } | { success: false; error: string } {
        return withFileLock(this.filePath(), () => {
            const records = this.readAll();
            const index = records.findIndex((record) => record.verification_id === verificationId);
            if (index < 0) return { success: false, error: "GitHub identity verification not found" };
            const now = new Date().toISOString();
            const record: GitHubIdentityVerificationRecord = {
                ...records[index]!,
                status: "revoked",
                updated_at: now,
                revoked_at: now,
                ...(input.revokedBy !== undefined && { revoked_by: input.revokedBy }),
                ...(input.revokeNote !== undefined && { revoke_note: input.revokeNote }),
            };
            records[index] = record;
            this.writeAll(records);
            return { success: true, record };
        });
    }
}

export function createFileGitHubIdentityVerificationRepository(identitiesDir: string): GitHubIdentityVerificationRepository {
    return new FileGitHubIdentityVerificationRepository(identitiesDir);
}
