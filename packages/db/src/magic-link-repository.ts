/**
 * Magic link token repository.
 *
 * Stores one-time-use, time-limited tokens for email-based login.
 * Raw token is never stored — only its SHA-256 hash.
 */

import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const TOKEN_TTL_MINUTES = 15;

export interface MagicLinkResult {
    rawToken: string;
    userId: string;
    email: string;
    expiresAt: Date;
}

export interface MagicLinkVerifyResult {
    userId: string;
    email: string;
}

export class MagicLinkRepository {
    constructor(private prisma: PrismaClient) { }

    /**
     * Create a new magic link token for the given email.
     * Returns the raw token (to be placed in the verify URL) — this is the only time it's available.
     */
    async create(email: string, requestIp?: string): Promise<MagicLinkResult> {
        const userId = `user-${email.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
        const rawToken = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

        await this.prisma.magicLinkToken.create({
            data: { tokenHash, email, userId, expiresAt, requestIp },
        });

        return { rawToken, userId, email, expiresAt };
    }

    /**
     * Verify and consume a magic link token.
     *
     * Returns user info on success, or an error string on failure.
     * The token is marked as consumed atomically — cannot be reused.
     */
    async verify(rawToken: string): Promise<
        { success: true; userId: string; email: string } |
        { success: false; error: string }
    > {
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const now = new Date();

        // Single atomic conditional update: consume only if not yet consumed AND not expired.
        // This eliminates the race window between read and update.
        const updated = await this.prisma.magicLinkToken.updateMany({
            where: {
                tokenHash,
                consumedAt: null,          // one-time use
                expiresAt: { gt: now },    // not expired
            },
            data: { consumedAt: now },
        });

        if (updated.count === 1) {
            // Successfully consumed — fetch user info
            const row = await this.prisma.magicLinkToken.findUnique({
                where: { tokenHash },
                select: { userId: true, email: true },
            });
            if (!row) {
                return { success: false, error: "Invalid or expired token" };
            }
            return { success: true, userId: row.userId, email: row.email };
        }

        // Update matched nothing — determine why for the error message
        const row = await this.prisma.magicLinkToken.findUnique({
            where: { tokenHash },
            select: { consumedAt: true, expiresAt: true },
        });

        if (!row) {
            return { success: false, error: "Invalid or expired token" };
        }
        if (row.consumedAt) {
            return { success: false, error: "This login link has already been used" };
        }
        if (row.expiresAt <= now) {
            return { success: false, error: "This login link has expired" };
        }

        // Should not reach here, but fallback
        return { success: false, error: "Invalid or expired token" };
    }

    /**
     * Clean up expired and consumed tokens.
     * Returns count of deleted tokens.
     * Safe to call from a cron job or admin endpoint.
     */
    async cleanupExpired(): Promise<{ deleted: number }> {
        const result = await this.prisma.magicLinkToken.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },  // expired
                    { consumedAt: { not: null } },       // already used
                ],
            },
        });
        return { deleted: result.count };
    }
}

