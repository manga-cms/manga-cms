/**
 * Entitlement repository — manages who can read what.
 *
 * Filesystem-backed MVP. Stores entitlements as JSON in `entitlements/` dir.
 * Designed for interface swap to DB later.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { EntitlementTargetType, EntitlementSource, EntitlementStatus } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Entitlement {
    id: string;
    userId: string;
    targetType: EntitlementTargetType;
    targetId: string;          // e.g. "rain-world" or "rain-world/ep02"
    source: EntitlementSource;
    status: EntitlementStatus;
    grantedAt: string;
    expiresAt?: string;
}

export interface EntitlementRepository {
    grant(input: {
        userId: string;
        targetType: EntitlementTargetType;
        targetId: string;
        source: EntitlementSource;
    }): Entitlement | Promise<Entitlement>;
    check(userId: string, targetType: EntitlementTargetType, targetId: string): boolean | Promise<boolean>;
    listForUser(userId: string): Entitlement[] | Promise<Entitlement[]>;
    revoke(entitlementId: string): boolean | Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Episode access model
// ---------------------------------------------------------------------------

/** Determines whether an episode requires entitlement. */
export interface AccessPolicy {
    isEpisodeFree(seriesId: string, episodeId: string, episodeNumber: number): boolean;
}

/**
 * Default policy: episode 1 is free, rest are locked.
 * Override by setting `"free": true` in episode.json.
 */
export class DefaultAccessPolicy implements AccessPolicy {
    isEpisodeFree(_seriesId: string, _episodeId: string, episodeNumber: number): boolean {
        return episodeNumber <= 1;
    }
}

// ---------------------------------------------------------------------------
// File-backed implementation
// ---------------------------------------------------------------------------

interface EntitlementStore {
    entitlements: Entitlement[];
}

export class FileEntitlementRepository implements EntitlementRepository {
    private storePath: string;

    constructor(private dir: string) {
        mkdirSync(dir, { recursive: true });
        this.storePath = join(dir, "store.json");
        if (!existsSync(this.storePath)) {
            this.save({ entitlements: [] });
        }
    }

    private load(): EntitlementStore {
        return JSON.parse(readFileSync(this.storePath, "utf-8"));
    }

    private save(store: EntitlementStore): void {
        writeFileSync(this.storePath, JSON.stringify(store, null, 2) + "\n", "utf-8");
    }

    grant(input: {
        userId: string;
        targetType: EntitlementTargetType;
        targetId: string;
        source: EntitlementSource;
    }): Entitlement {
        const store = this.load();
        // Check for existing active entitlement
        const existing = store.entitlements.find(
            (e) => e.userId === input.userId && e.targetId === input.targetId && e.status === "ACTIVE",
        );
        if (existing) return existing;

        const ent: Entitlement = {
            id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            userId: input.userId,
            targetType: input.targetType,
            targetId: input.targetId,
            source: input.source,
            status: "ACTIVE",
            grantedAt: new Date().toISOString(),
        };
        store.entitlements.push(ent);
        this.save(store);
        return ent;
    }

    check(userId: string, targetType: EntitlementTargetType, targetId: string): boolean {
        const store = this.load();
        return store.entitlements.some(
            (e) =>
                e.userId === userId &&
                e.status === "ACTIVE" &&
                (
                    // Exact match
                    (e.targetType === targetType && e.targetId === targetId) ||
                    // Series-level entitlement covers all episodes of that series.
                    // Require exact seriesId match followed by '/' to prevent
                    // "rain" matching "rain-world/ep02".
                    (e.targetType === "SERIES" && targetType === "EPISODE" &&
                        targetId.startsWith(e.targetId + "/"))
                ),
        );
    }

    listForUser(userId: string): Entitlement[] {
        return this.load().entitlements.filter((e) => e.userId === userId);
    }

    revoke(entitlementId: string): boolean {
        const store = this.load();
        const ent = store.entitlements.find((e) => e.id === entitlementId);
        if (!ent) return false;
        ent.status = "REVOKED";
        this.save(store);
        return true;
    }
}

export function createFileEntitlementRepository(dir: string): EntitlementRepository {
    return new FileEntitlementRepository(dir);
}
