/**
 * DB-backed RightsRepository using Prisma.
 *
 * Stores runtime production permissions only. Reader entitlements and canonical
 * contents/ manga data remain separate.
 */

import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type {
    RightsGrantCreateInput,
    RightsGrantListFilters,
    RightsGrantRecord,
    RightsPermissionCheckInput,
    RightsPermissionCheckResponse,
    RightsRepository,
    RightsScope,
    RightsUsage,
} from "@manga/domain";

export class DbRightsRepository implements RightsRepository {
    constructor(private prisma: PrismaClient) { }

    async createGrant(input: RightsGrantCreateInput): Promise<RightsGrantRecord> {
        const grantId = `rg_${randomUUID()}`;
        const row = await this.prisma.rightsGrant.create({
            data: {
                grantId,
                subjectUserId: input.subject_user_id,
                role: input.role,
                permissionsJson: JSON.stringify(input.permissions),
                scopeJson: JSON.stringify(input.scope),
                seriesId: input.scope.series_id,
                episodeId: input.scope.episode_id,
                language: input.scope.language,
                packId: input.scope.pack_id,
                territory: input.scope.territory,
                usageJson: input.scope.usage ? JSON.stringify(input.scope.usage) : undefined,
                startsAt: input.starts_at ? new Date(input.starts_at) : undefined,
                endsAt: input.ends_at ? new Date(input.ends_at) : null,
                grantedBy: input.granted_by ?? null,
                notes: input.notes,
            },
        });
        return this.toRecord(row);
    }

    async listGrants(filters: RightsGrantListFilters = {}): Promise<RightsGrantRecord[]> {
        const rows = await this.prisma.rightsGrant.findMany({
            where: {
                ...(filters.userId ? { subjectUserId: filters.userId } : {}),
                ...(filters.seriesId ? { seriesId: filters.seriesId } : {}),
                ...(!filters.includeRevoked ? { revokedAt: null } : {}),
            },
            orderBy: { createdAt: "desc" },
        });

        return rows
            .map((row) => this.toRecord(row))
            .filter((record) => !filters.permission || record.permissions.includes(filters.permission as any));
    }

    async getGrant(grantId: string): Promise<RightsGrantRecord | undefined> {
        const row = await this.prisma.rightsGrant.findUnique({ where: { grantId } });
        return row ? this.toRecord(row) : undefined;
    }

    async revokeGrant(grantId: string): Promise<{ success: true; record: RightsGrantRecord } | { success: false; error: string }> {
        try {
            const row = await this.prisma.rightsGrant.update({
                where: { grantId },
                data: { revokedAt: new Date() },
            });
            return { success: true, record: this.toRecord(row) };
        } catch {
            return { success: false, error: "Rights grant not found" };
        }
    }

    async checkPermission(input: RightsPermissionCheckInput): Promise<RightsPermissionCheckResponse> {
        const now = new Date();
        const rows = await this.prisma.rightsGrant.findMany({
            where: {
                subjectUserId: input.user_id,
                revokedAt: null,
                OR: [
                    { startsAt: null },
                    { startsAt: { lte: now } },
                ],
                AND: [
                    {
                        OR: [
                            { endsAt: null },
                            { endsAt: { gt: now } },
                        ],
                    },
                ],
            },
            orderBy: { createdAt: "desc" },
        });

        const matched = rows
            .map((row) => this.toRecord(row))
            .filter((record) => record.permissions.includes(input.permission))
            .filter((record) => scopeMatches(record.scope, input.scope));

        return {
            allowed: matched.length > 0,
            matched_grant_ids: matched.map((record) => record.grant_id),
            ...(matched.length === 0 ? { reason: "No active matching rights grant" } : {}),
        };
    }

    private toRecord(row: any): RightsGrantRecord {
        const scope = parseJson<RightsScope>(row.scopeJson, {});
        return {
            grant_id: row.grantId,
            subject_user_id: row.subjectUserId,
            role: row.role,
            permissions: parseJson(row.permissionsJson, []),
            scope,
            ...(row.startsAt ? { starts_at: toIso(row.startsAt) } : {}),
            ...(row.endsAt ? { ends_at: toIso(row.endsAt) } : row.endsAt === null ? { ends_at: null } : {}),
            ...(row.grantedBy !== null && row.grantedBy !== undefined ? { granted_by: row.grantedBy } : {}),
            ...(row.notes ? { notes: row.notes } : {}),
            created_at: toIso(row.createdAt),
            updated_at: toIso(row.updatedAt),
            ...(row.revokedAt ? { revoked_at: toIso(row.revokedAt) } : {}),
        };
    }
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

function toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
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
        if (!requestedUsage.every((usage: RightsUsage) => grantScope.usage?.includes(usage))) return false;
    }
    return true;
}
