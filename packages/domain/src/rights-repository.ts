import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type {
    RightsGrantCreateInput,
    RightsGrantRecord,
    RightsPermissionCheckInput,
    RightsPermissionCheckResponse,
    RightsScope,
} from "./rights-types.js";
import { withFileLock } from "./file-lock.js";

export interface RightsGrantListFilters {
    userId?: string;
    seriesId?: string;
    permission?: string;
    includeRevoked?: boolean;
}

export interface RightsRepository {
    createGrant(input: RightsGrantCreateInput): RightsGrantRecord;
    listGrants(filters?: RightsGrantListFilters): RightsGrantRecord[];
    getGrant(grantId: string): RightsGrantRecord | undefined;
    revokeGrant(grantId: string): { success: true; record: RightsGrantRecord } | { success: false; error: string };
    checkPermission(input: RightsPermissionCheckInput): RightsPermissionCheckResponse;
}

export class FileRightsRepository implements RightsRepository {
    constructor(private rightsDir: string) { }

    private filePath(): string {
        return join(this.rightsDir, "rights-grants.json");
    }

    private readAll(): RightsGrantRecord[] {
        const filePath = this.filePath();
        if (!existsSync(filePath)) return [];
        const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as { grants?: RightsGrantRecord[] };
        return [...(parsed.grants ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    private writeAll(records: RightsGrantRecord[]): void {
        mkdirSync(this.rightsDir, { recursive: true });
        const filePath = this.filePath();
        const tmpPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
        writeFileSync(tmpPath, JSON.stringify({ grants: records }, null, 2) + "\n", "utf-8");
        renameSync(tmpPath, filePath);
    }

    createGrant(input: RightsGrantCreateInput): RightsGrantRecord {
        return withFileLock(this.filePath(), () => {
            const records = this.readAll();
            const now = new Date().toISOString();
            const record: RightsGrantRecord = {
                ...input,
                grant_id: `rg_${randomUUID()}`,
                created_at: now,
                updated_at: now,
            };
            records.push(record);
            this.writeAll(records);
            return record;
        });
    }

    listGrants(filters: RightsGrantListFilters = {}): RightsGrantRecord[] {
        return this.readAll().filter((record) => {
            if (!filters.includeRevoked && record.revoked_at) return false;
            if (filters.userId && record.subject_user_id !== filters.userId) return false;
            if (filters.seriesId && record.scope.series_id !== filters.seriesId) return false;
            if (filters.permission && !record.permissions.includes(filters.permission as any)) return false;
            return true;
        });
    }

    getGrant(grantId: string): RightsGrantRecord | undefined {
        return this.readAll().find((record) => record.grant_id === grantId);
    }

    revokeGrant(grantId: string): { success: true; record: RightsGrantRecord } | { success: false; error: string } {
        return withFileLock(this.filePath(), () => {
            const records = this.readAll();
            const index = records.findIndex((record) => record.grant_id === grantId);
            if (index < 0) return { success: false, error: "Rights grant not found" };
            const now = new Date().toISOString();
            const record: RightsGrantRecord = {
                ...records[index]!,
                revoked_at: now,
                updated_at: now,
            };
            records[index] = record;
            this.writeAll(records);
            return { success: true, record };
        });
    }

    checkPermission(input: RightsPermissionCheckInput): RightsPermissionCheckResponse {
        const nowMs = Date.now();
        const matched = this.readAll().filter((record) => {
            if (record.subject_user_id !== input.user_id) return false;
            if (record.revoked_at) return false;
            if (!record.permissions.includes(input.permission)) return false;
            if (record.starts_at && Date.parse(record.starts_at) > nowMs) return false;
            if (record.ends_at && Date.parse(record.ends_at) <= nowMs) return false;
            return scopeMatches(record.scope, input.scope);
        });

        return {
            allowed: matched.length > 0,
            matched_grant_ids: matched.map((record) => record.grant_id),
            ...(matched.length === 0 ? { reason: "No active matching rights grant" } : {}),
        };
    }
}

function scopeMatches(grantScope: RightsScope, requestedScope: RightsScope): boolean {
    if (grantScope.series_id && grantScope.series_id !== requestedScope.series_id) return false;
    if (grantScope.episode_id && grantScope.episode_id !== requestedScope.episode_id) return false;
    if (grantScope.language && grantScope.language !== requestedScope.language) return false;
    if (grantScope.pack_id && grantScope.pack_id !== requestedScope.pack_id) return false;
    if (grantScope.territory && grantScope.territory !== requestedScope.territory) return false;
    if (grantScope.usage?.length) {
        const requestedUsage = requestedScope.usage ?? [];
        if (requestedUsage.length === 0) return false;
        if (!requestedUsage.every((usage) => grantScope.usage?.includes(usage))) return false;
    }
    return true;
}

export function createFileRightsRepository(rightsDir: string): RightsRepository {
    return new FileRightsRepository(rightsDir);
}
