/**
 * Purchase and redeem code repository.
 *
 * Creates purchase records, generates redeem codes, and handles redemption
 * that grants entitlements.
 */

import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export interface PurchaseInfo {
    id: string;
    provider: string;
    productId: string;
    status: string;
    createdAt: string;
    codes: RedeemCodeInfo[];
}

export interface RedeemCodeInfo {
    id: string;
    code: string;
    targetType: string;
    targetId: string;
    status: string;
    maxRedemptions: number;
    currentRedemptions: number;
    createdAt: string;
}

export class PurchaseRepository {
    constructor(private prisma: PrismaClient) { }

    /**
     * Create a purchase record with redeem codes.
     */
    async createPurchase(input: {
        provider: string;
        providerPurchaseId?: string;
        productId: string;
        buyerEmail?: string;
        currency?: string;
        amount?: number;
        codes: { targetType: string; targetId: string; maxRedemptions?: number }[];
        createdBy?: string;
        metadata?: string;
    }): Promise<PurchaseInfo> {
        // Idempotency: if providerPurchaseId is given and already exists, return existing
        if (input.providerPurchaseId) {
            const existing = await this.prisma.purchaseRecord.findFirst({
                where: {
                    provider: input.provider,
                    providerPurchaseId: input.providerPurchaseId,
                },
            });
            if (existing) {
                const codes = await this.prisma.redeemCode.findMany({
                    where: { purchaseId: existing.id },
                });
                return {
                    id: existing.id,
                    provider: existing.provider,
                    productId: existing.productId,
                    status: existing.status,
                    createdAt: existing.createdAt.toISOString(),
                    codes: codes.map(this.toCodeInfo),
                };
            }
        }

        const purchase = await this.prisma.purchaseRecord.create({
            data: {
                provider: input.provider,
                providerPurchaseId: input.providerPurchaseId,
                productId: input.productId,
                buyerEmail: input.buyerEmail,
                currency: input.currency,
                amount: input.amount,
                createdBy: input.createdBy,
                metadata: input.metadata,
                status: "COMPLETED",
                completedAt: new Date(),
            },
        });

        const codes: RedeemCodeInfo[] = [];
        for (const c of input.codes) {
            const code = this.generateCode();
            const row = await this.prisma.redeemCode.create({
                data: {
                    code,
                    purchaseId: purchase.id,
                    targetType: c.targetType,
                    targetId: c.targetId,
                    maxRedemptions: c.maxRedemptions ?? 1,
                },
            });
            codes.push(this.toCodeInfo(row));
        }

        return {
            id: purchase.id,
            provider: purchase.provider,
            productId: purchase.productId,
            status: purchase.status,
            createdAt: purchase.createdAt.toISOString(),
            codes,
        };
    }

    /**
     * Redeem a code for a user. Returns the entitlement target if successful.
     */
    async redeem(code: string, userId: string, redeemedIp?: string): Promise<
        { success: true; targetType: string; targetId: string; entitlementId: string } |
        { success: false; error: string }
    > {
        try {
            return await this.prisma.$transaction(async (tx: any) => {
                const row = await tx.redeemCode.findUnique({ where: { code } });
                if (!row) return { success: false as const, error: "Invalid code" };
                if (row.status === "REVOKED") return { success: false as const, error: "Code has been revoked" };
                if (row.status === "EXHAUSTED") return { success: false as const, error: "Code has been fully redeemed" };
                if (row.currentRedemptions >= row.maxRedemptions) {
                    await tx.redeemCode.update({
                        where: { id: row.id },
                        data: { status: "EXHAUSTED" },
                    });
                    return { success: false as const, error: "Code has been fully redeemed" };
                }

                // Optimistic concurrency: conditional update only if count hasn't changed
                const updated = await tx.redeemCode.updateMany({
                    where: {
                        id: row.id,
                        currentRedemptions: row.currentRedemptions, // CAS guard
                    },
                    data: {
                        currentRedemptions: row.currentRedemptions + 1,
                        status: row.currentRedemptions + 1 >= row.maxRedemptions ? "EXHAUSTED" : "ACTIVE",
                        redeemedByUserId: userId,
                        redeemedIp,
                        redeemedAt: new Date(),
                    },
                });

                if (updated.count === 0) {
                    return { success: false as const, error: "Code was redeemed by another request" };
                }

                // Grant entitlement atomically within the same transaction
                const existing = await tx.entitlement.findFirst({
                    where: { userId, targetId: row.targetId, status: "ACTIVE" },
                });

                let entitlementId: string;
                if (existing) {
                    entitlementId = existing.id;
                } else {
                    const ent = await tx.entitlement.create({
                        data: {
                            userId,
                            targetType: row.targetType,
                            targetId: row.targetId,
                            source: "REDEEM",
                            status: "ACTIVE",
                        },
                    });
                    entitlementId = ent.id;
                }

                return {
                    success: true as const,
                    targetType: row.targetType,
                    targetId: row.targetId,
                    entitlementId,
                };
            });
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    }

    async listPurchases(): Promise<PurchaseInfo[]> {
        const rows = await this.prisma.purchaseRecord.findMany({
            orderBy: { createdAt: "desc" },
        });
        const result: PurchaseInfo[] = [];
        for (const r of rows) {
            const codes = await this.prisma.redeemCode.findMany({
                where: { purchaseId: r.id },
            });
            result.push({
                id: r.id,
                provider: r.provider,
                productId: r.productId,
                status: r.status,
                createdAt: r.createdAt.toISOString(),
                codes: codes.map(this.toCodeInfo),
            });
        }
        return result;
    }

    private generateCode(): string {
        // Format: XXXX-XXXX-XXXX (uppercase alphanumeric)
        const raw = randomBytes(9).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
        return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
    }

    private toCodeInfo(row: any): RedeemCodeInfo {
        return {
            id: row.id,
            code: row.code,
            targetType: row.targetType,
            targetId: row.targetId,
            status: row.status,
            maxRedemptions: row.maxRedemptions,
            currentRedemptions: row.currentRedemptions,
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        };
    }
}
