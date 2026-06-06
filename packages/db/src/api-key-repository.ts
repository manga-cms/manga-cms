/**
 * API Key repository for production auth.
 */

import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export interface ApiKeyInfo {
    id: string;
    keyPrefix: string;
    userId: string;
    name: string;
    role: string;
    createdAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
}

export class ApiKeyRepository {
    constructor(private prisma: PrismaClient) { }

    private hashKey(rawKey: string): string {
        return createHash("sha256").update(rawKey).digest("hex");
    }

    /**
     * Create a new API key. Returns the raw key (only shown once) + metadata.
     */
    async create(userId: string, name: string, role: string = "admin"): Promise<{ rawKey: string; info: ApiKeyInfo }> {
        const rawKey = `mk_${randomBytes(24).toString("base64url")}`;
        const keyHash = this.hashKey(rawKey);
        const keyPrefix = rawKey.slice(0, 11); // "mk_" + 8 chars

        const row = await this.prisma.apiKey.create({
            data: { keyHash, keyPrefix, userId, name, role },
        });

        return {
            rawKey,
            info: this.toInfo(row),
        };
    }

    /**
     * Verify a raw API key. Returns user info if valid.
     */
    async verify(rawKey: string): Promise<{ id: string; name: string; role: string } | null> {
        const keyHash = this.hashKey(rawKey);
        const row = await this.prisma.apiKey.findUnique({ where: { keyHash } });
        if (!row || row.revokedAt) return null;

        // Update lastUsedAt (fire-and-forget)
        this.prisma.apiKey.update({
            where: { id: row.id },
            data: { lastUsedAt: new Date() },
        }).catch(() => { });

        return { id: row.userId, name: row.name, role: row.role };
    }

    async list(userId?: string): Promise<ApiKeyInfo[]> {
        const where = userId ? { userId } : {};
        const rows = await this.prisma.apiKey.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        return rows.map(this.toInfo);
    }

    async revoke(keyId: string): Promise<boolean> {
        try {
            await this.prisma.apiKey.update({
                where: { id: keyId },
                data: { revokedAt: new Date() },
            });
            return true;
        } catch {
            return false;
        }
    }

    private toInfo(row: any): ApiKeyInfo {
        return {
            id: row.id,
            keyPrefix: row.keyPrefix,
            userId: row.userId,
            name: row.name,
            role: row.role,
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
            lastUsedAt: row.lastUsedAt instanceof Date ? row.lastUsedAt.toISOString() : row.lastUsedAt,
            revokedAt: row.revokedAt instanceof Date ? row.revokedAt.toISOString() : row.revokedAt,
        };
    }
}
