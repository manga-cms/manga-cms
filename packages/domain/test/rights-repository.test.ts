import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFileRightsRepository } from "../dist/rights-repository.js";
import { isActiveRightsGrant, scopeMatches } from "../dist/rights-evaluation.js";
import type { RightsGrantRecord, RightsScope } from "../src/rights-types.ts";

const nowMs = Date.parse("2026-06-13T00:00:00.000Z");

function grant(overrides: Partial<RightsGrantRecord> = {}): RightsGrantRecord {
    return {
        grant_id: "grant-1",
        subject_user_id: "user-1",
        role: "editor",
        permissions: ["edit_structure"],
        scope: { series_id: "series-1" },
        created_at: "2026-06-01T00:00:00.000Z",
        updated_at: "2026-06-01T00:00:00.000Z",
        ...overrides,
    };
}

test("scopeMatches allows broad grants to match narrower requested scopes", () => {
    assert.equal(scopeMatches({}, { series_id: "series-1", episode_id: "ep01" }), true);
});

test("scopeMatches rejects requests outside a series-scoped grant", () => {
    assert.equal(scopeMatches({ series_id: "series-1" }, { series_id: "series-1" }), true);
    assert.equal(scopeMatches({ series_id: "series-1" }, { series_id: "series-2" }), false);
});

test("scopeMatches does not let episode-scoped grants satisfy series-level requests", () => {
    assert.equal(scopeMatches({ series_id: "series-1", episode_id: "ep01" }, { series_id: "series-1" }), false);
    assert.equal(scopeMatches({ series_id: "series-1", episode_id: "ep01" }, { series_id: "series-1", episode_id: "ep01" }), true);
});

test("scopeMatches requires requested usage to be covered by the grant usage set", () => {
    const grantScope: RightsScope = { series_id: "series-1", usage: ["free_view", "promotional"] };

    assert.equal(scopeMatches(grantScope, { series_id: "series-1", usage: ["free_view"] }), true);
    assert.equal(scopeMatches(grantScope, { series_id: "series-1", usage: ["free_view", "commercial_distribution"] }), false);
    assert.equal(scopeMatches(grantScope, { series_id: "series-1" }), false);
});

test("isActiveRightsGrant rejects revoked, future, and expired grants", () => {
    assert.equal(isActiveRightsGrant(grant(), nowMs), true);
    assert.equal(isActiveRightsGrant(grant({ revoked_at: "2026-06-12T00:00:00.000Z" }), nowMs), false);
    assert.equal(isActiveRightsGrant(grant({ starts_at: "2026-06-14T00:00:00.000Z" }), nowMs), false);
    assert.equal(isActiveRightsGrant(grant({ ends_at: "2026-06-12T00:00:00.000Z" }), nowMs), false);
});

test("FileRightsRepository createGrant and checkPermission roundtrip matching scopes", () => {
    const dir = mkdtempSync(join(tmpdir(), "manga-rights-test-"));
    try {
        const repo = createFileRightsRepository(dir);
        const record = repo.createGrant({
            subject_user_id: "user-1",
            role: "editor",
            permissions: ["edit_structure"],
            scope: { series_id: "series-1" },
            granted_by: "admin-1",
        });

        assert.equal(record.subject_user_id, "user-1");
        assert.equal(record.scope.series_id, "series-1");

        assert.deepEqual(repo.checkPermission({
            user_id: "user-1",
            permission: "edit_structure",
            scope: { series_id: "series-1" },
        }), {
            allowed: true,
            matched_grant_ids: [record.grant_id],
        });

        assert.deepEqual(repo.checkPermission({
            user_id: "user-1",
            permission: "edit_structure",
            scope: { series_id: "series-2" },
        }), {
            allowed: false,
            matched_grant_ids: [],
            reason: "No active matching rights grant",
        });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("FileRightsRepository revokeGrant records revokedBy and disables permission checks", () => {
    const dir = mkdtempSync(join(tmpdir(), "manga-rights-test-"));
    try {
        const repo = createFileRightsRepository(dir);
        const record = repo.createGrant({
            subject_user_id: "user-1",
            role: "editor",
            permissions: ["edit_structure"],
            scope: { series_id: "series-1" },
        });

        const revoked = repo.revokeGrant(record.grant_id, { revokedBy: "admin-1" });
        assert.equal(revoked.success, true);
        assert.equal(revoked.success && revoked.record.revoked_by, "admin-1");
        assert.equal(repo.checkPermission({
            user_id: "user-1",
            permission: "edit_structure",
            scope: { series_id: "series-1" },
        }).allowed, false);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
