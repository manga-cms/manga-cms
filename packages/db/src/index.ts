/**
 * @manga/db — Database access layer.
 *
 * Provides a PrismaClient singleton and DB-backed repository implementations.
 * The API server uses this when DATABASE_URL is set.
 */

import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Singleton PrismaClient
// ---------------------------------------------------------------------------

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
    if (!_prisma) {
        _prisma = new PrismaClient();
    }
    return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
    if (_prisma) {
        await _prisma.$disconnect();
        _prisma = null;
    }
}

/**
 * Check if DB is reachable.
 */
export async function checkDbHealth(): Promise<boolean> {
    try {
        const prisma = getPrisma();
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { DbEntitlementRepository } from "./entitlement-repository.js";
export { DbIngestionRepository } from "./ingestion-repository.js";
export { ApiKeyRepository } from "./api-key-repository.js";
export type { ApiKeyInfo } from "./api-key-repository.js";
export { PurchaseRepository } from "./purchase-repository.js";
export type { PurchaseInfo, RedeemCodeInfo } from "./purchase-repository.js";
export { MagicLinkRepository } from "./magic-link-repository.js";
export type { MagicLinkResult, MagicLinkVerifyResult } from "./magic-link-repository.js";
