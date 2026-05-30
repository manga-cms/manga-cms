export type ProposalKind = "translation" | "typo" | "footnote" | "commentary" | "tag" | "structure";

export type ProposalStatus = "new" | "triaged" | "accepted" | "rejected" | "closed";

export interface ProposalTarget {
    series_id: string;
    episode_id: string;
    page_id?: string | null;
    panel_id?: string | null;
    bubble_id?: string | null;
}

export interface ProposalCreateInput extends ProposalTarget {
    kind: ProposalKind;
    status?: ProposalStatus;
    source_feedback_id?: string | null;
    lang?: string;
    current_text?: string;
    current_translation?: string;
    suggested_text?: string;
    comment?: string;
    proposer_id?: string | null;
    source_url?: string;
}

export interface ProposalRecord extends ProposalCreateInput {
    proposal_id: string;
    status: ProposalStatus;
    created_at: string;
    updated_at: string;
    review_note?: string;
    reviewed_by?: string;
    reviewed_at?: string;
}
