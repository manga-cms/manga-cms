import type { RightsGrantRecord, RightsScope } from "./rights-types.js";

export function scopeMatches(grantScope: RightsScope, requestedScope: RightsScope): boolean {
    if (grantScope.series_id && grantScope.series_id !== requestedScope.series_id) return false;
    if (grantScope.episode_id && grantScope.episode_id !== requestedScope.episode_id) return false;
    if (grantScope.language && grantScope.language !== requestedScope.language) return false;
    if (grantScope.pack_id && grantScope.pack_id !== requestedScope.pack_id) return false;
    if (grantScope.territory && grantScope.territory !== requestedScope.territory) return false;
    if (grantScope.usage?.length) {
        const requestedUsage = requestedScope.usage ?? [];
        if (requestedUsage.length === 0) return false;
        if (!requestedUsage.every((usage) => grantScope.usage?.includes(usage))) return false;
    }
    return true;
}

export function isActiveRightsGrant(record: RightsGrantRecord, nowMs = Date.now()): boolean {
    if (record.revoked_at) return false;
    if (record.starts_at && Date.parse(record.starts_at) > nowMs) return false;
    if (record.ends_at && Date.parse(record.ends_at) <= nowMs) return false;
    return true;
}
