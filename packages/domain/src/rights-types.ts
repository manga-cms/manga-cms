export type RightsRole =
    | "owner"
    | "editor"
    | "translator"
    | "reviewer"
    | "contributor"
    | "moderator"
    | "viewer"
    | "original_rights_holder"
    | "translation_reviewer"
    | "footnote_contributor"
    | "pack_maintainer"
    | "publisher";

export type RightsPermission =
    | "propose_translation"
    | "propose_footnote"
    | "edit_structure"
    | "edit_translation"
    | "review_translation"
    | "review_footnote"
    | "approve_translation"
    | "approve_footnote"
    | "publish_pack"
    | "manage_rights"
    | "moderate_proposals"
    | "commercial_use";

export type RightsUsage =
    | "free_view"
    | "paid_view"
    | "promotional"
    | "commercial_distribution";

export interface RightsScope {
    series_id?: string;
    episode_id?: string;
    language?: string;
    pack_id?: string;
    usage?: RightsUsage[];
    territory?: string;
}

export interface RightsGrantCreateInput {
    subject_user_id: string;
    role: RightsRole;
    permissions: RightsPermission[];
    scope: RightsScope;
    starts_at?: string;
    ends_at?: string | null;
    granted_by?: string | null;
    notes?: string;
}

export interface RightsGrantRecord extends RightsGrantCreateInput {
    grant_id: string;
    created_at: string;
    updated_at: string;
    revoked_at?: string | null;
    revoked_by?: string | null;
}

export interface RightsGrantRevokeInput {
    revokedBy?: string | null;
}

export interface RightsPermissionCheckInput {
    user_id: string;
    permission: RightsPermission;
    scope: RightsScope;
}

export interface RightsPermissionCheckResponse {
    allowed: boolean;
    matched_grant_ids: string[];
    reason?: string;
}
