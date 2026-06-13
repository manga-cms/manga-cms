import type { BubbleTextLayout, BubbleTextStyle, PackType } from "./types.js";

export type PackDraftStatus = "draft" | "in_review" | "approved" | "published" | "archived";

export interface PackDraftEntryTarget {
    series_id: string;
    episode_id?: string | null;
    page_id?: string | null;
    panel_id?: string | null;
    bubble_id?: string | null;
}

export interface PackDraftEntry {
    entry_id: string;
    source_proposal_id?: string | null;
    target: PackDraftEntryTarget;
    lang?: string;
    original_text?: string;
    current_translation?: string;
    text?: string;
    note?: string;
    metadata?: Record<string, unknown>;
    text_layout?: BubbleTextLayout;
    text_style?: BubbleTextStyle;
    adopted_at: string;
    adopted_by?: string | null;
}

export interface PackDraftCreateInput {
    type: PackType;
    title: string;
    language?: string;
    target_series_id?: string;
    target_episode_id?: string;
    version?: number;
    created_by?: string | null;
}

export interface PackDraftRecord extends PackDraftCreateInput {
    pack_draft_id: string;
    status: PackDraftStatus;
    version: number;
    entries: PackDraftEntry[];
    created_at: string;
    updated_at: string;
    reviewed_by?: string | null;
    reviewed_at?: string;
}
