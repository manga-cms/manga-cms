/**
 * Delivery token helpers.
 *
 * Generates short-lived, request-bound delivery tokens for gated content.
 * In production, replace with HMAC-signed tokens or signed CDN URLs.
 * Current implementation: base64-encoded JSON with expiry.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DELIVERY_SECRET = process.env.DELIVERY_SECRET ?? "manga-dev-secret-change-me";
const TOKEN_TTL_SECONDS = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export interface DeliveryTokenPayload {
    pageId: string;
    userId: string;
    exp: number; // unix timestamp
}

export function generateDeliveryToken(pageId: string, userId: string): string {
    const payload: DeliveryTokenPayload = {
        pageId,
        userId,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };
    const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = createHmac("sha256", DELIVERY_SECRET).update(data).digest("base64url");
    return `${data}.${sig}`;
}

export function verifyDeliveryToken(token: string): DeliveryTokenPayload | null {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;

    const expectedSig = createHmac("sha256", DELIVERY_SECRET).update(data).digest("base64url");
    const sigBuffer = Buffer.from(sig);
    const expectedSigBuffer = Buffer.from(expectedSig);
    if (sigBuffer.length !== expectedSigBuffer.length || !timingSafeEqual(sigBuffer, expectedSigBuffer)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as DeliveryTokenPayload;
        if (typeof payload.pageId !== "string" || typeof payload.userId !== "string" || !Number.isFinite(payload.exp)) {
            return null;
        }
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Watermark stub
// ---------------------------------------------------------------------------

/**
 * Placeholder for watermark injection.
 * In production: composite userId into image data for forensic tracing.
 * Currently: returns the original file path unchanged.
 */
export function applyWatermark(filePath: string, _userId: string): string {
    // TODO: Implement actual watermark compositing
    return filePath;
}

// ---------------------------------------------------------------------------
// Dev auth
// ---------------------------------------------------------------------------

export interface DevUser {
    id: string;
    name: string;
    role: "admin" | "user";
}

const DEV_AUTH_SECRET = process.env.DEV_AUTH_SECRET ?? "manga-dev-auth";

export function generateAuthToken(user: DevUser): string {
    const data = Buffer.from(JSON.stringify(user)).toString("base64url");
    const sig = createHmac("sha256", DEV_AUTH_SECRET).update(data).digest("base64url");
    return `${data}.${sig}`;
}

export function verifyAuthToken(token: string): DevUser | null {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;

    const expectedSig = createHmac("sha256", DEV_AUTH_SECRET).update(data).digest("base64url");
    if (sig !== expectedSig) return null;

    try {
        return JSON.parse(Buffer.from(data, "base64url").toString()) as DevUser;
    } catch {
        return null;
    }
}
