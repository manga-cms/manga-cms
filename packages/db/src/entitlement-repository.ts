/**
 * DB-backed EntitlementRepository using Prisma.
 *
 * Same interface as FileEntitlementRepository from @manga/domain.
 * Swap in when DATABASE_URL is set.
 */

import type { PrismaClient } from "@prisma/client";
import type {
    EntitlementRepository,
    Entitlement,
} from "@manga/domain";
import type { EntitlementTargetType, EntitlementSource } from "@manga/domain";

export class DbEntitlementRepository implements EntitlementRepository {
    constructor(private prisma: PrismaClient) { }

    async grant(input: {
        userId: string;
        targetType: EntitlementTargetType;
        targetId: string;
        source: EntitlementSource;
    }): Promise<Entitlement> {
        // Check for existing active entitlement
        const existing = await this.prisma.entitlement.findFirst({
            where: {
                userId: input.userId,
                targetId: input.targetId,
                status: "ACTIVE",
            },
        });
        if (existing) return this.toEntitlement(existing);

        const ent = await this.prisma.entitlement.create({
            data: {
                userId: input.userId,
                targetType: input.targetType,
                targetId: input.targetId,
                source: input.source,
                status: "ACTIVE",
            },
        });
        return this.toEntitlement(ent);
    }

    async check(userId: string, targetType: EntitlementTargetType, targetId: string): Promise<boolean> {
        // Exact match
        const exact = await this.prisma.entitlement.findFirst({
            where: {
                userId,
                targetType,
                targetId,
                status: "ACTIVE",
            },
        });
        if (exact) return true;

        // Series-level entitlement covers all episodes
        if (targetType === "EPISODE" && targetId.includes("/")) {
            const seriesId = targetId.split("/")[0];
            const seriesGrant = await this.prisma.entitlement.findFirst({
                where: {
                    userId,
                    targetType: "SERIES",
                    targetId: seriesId,
                    status: "ACTIVE",
                },
            });
            if (seriesGrant) return true;
        }

        return false;
    }

    async listForUser(userId: string): Promise<Entitlement[]> {
        const rows = await this.prisma.entitlement.findMany({
            where: { userId },
            orderBy: { grantedAt: "desc" },
        });
        return rows.map(this.toEntitlement);
    }

    async revoke(entitlementId: string): Promise<boolean> {
        try {
            await this.prisma.entitlement.update({
                where: { id: entitlementId },
                data: { status: "REVOKED", revokedAt: new Date() },
            });
            return true;
        } catch {
            return false;
        }
    }

    private toEntitlement(row: any): Entitlement {
        return {
            id: row.id,
            userId: row.userId,
            targetType: row.targetType,
            targetId: row.targetId,
            source: row.source,
            status: row.status,
            grantedAt: row.grantedAt instanceof Date ? row.grantedAt.toISOString() : row.grantedAt,
            expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt ?? undefined,
        };
    }
}
