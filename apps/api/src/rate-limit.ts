/**
 * In-memory sliding-window rate limiter.
 *
 * Tracks request counts per key (IP or email) in a configurable time window.
 * No external dependencies — suitable for single-instance deployments.
 * For multi-instance, swap to Redis-backed implementation.
 */

interface RateLimitEntry {
    count: number;
    resetAt: number; // epoch ms
}

export interface RateLimitConfig {
    /** Max requests per window */
    maxRequests: number;
    /** Window duration in seconds */
    windowSeconds: number;
}

const DEFAULT_DEV: RateLimitConfig = { maxRequests: 20, windowSeconds: 60 };
const DEFAULT_PROD: RateLimitConfig = { maxRequests: 5, windowSeconds: 300 };

export class RateLimiter {
    private store = new Map<string, RateLimitEntry>();
    private config: RateLimitConfig;

    constructor(config?: RateLimitConfig) {
        const isProd = process.env.NODE_ENV === "production";
        this.config = config ?? (isProd ? DEFAULT_PROD : DEFAULT_DEV);

        // Periodic cleanup of expired entries (every 5 minutes)
        setInterval(() => this.cleanup(), 5 * 60_000).unref();
    }

    /**
     * Check if a key is rate-limited.
     * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
     */
    check(key: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry || now >= entry.resetAt) {
            // New window
            this.store.set(key, {
                count: 1,
                resetAt: now + this.config.windowSeconds * 1000,
            });
            return { allowed: true };
        }

        if (entry.count < this.config.maxRequests) {
            entry.count++;
            return { allowed: true };
        }

        return {
            allowed: false,
            retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
        };
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now >= entry.resetAt) {
                this.store.delete(key);
            }
        }
    }
}
