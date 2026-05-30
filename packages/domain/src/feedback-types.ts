export type FeedbackIssueType =
    | "typo"
    | "mistranslation"
    | "better_translation"
    | "missing_note"
    | "display"
    | "broken_link"
    | "spoiler"
    | "other";

export type ReaderMode = "read" | "explore" | "completion";

export type FeedbackStatus = "new" | "triaged" | "closed";

export interface FeedbackPayload {
    series_id: string;
    episode_id: string;
    page_id?: string | null;
    panel_id?: string | null;
    bubble_id?: string | null;
    mode: ReaderMode;
    issue_type: FeedbackIssueType;
    comment?: string;
    lang?: string;
    current_text?: string;
    current_translation?: string;
    suggested_text?: string;
    user_id?: string | null;
    source_url: string;
    user_agent?: string;
    client_time?: string;
    /** Honeypot field. Real users never fill this. */
    website?: string;
}

export interface FeedbackRecord extends Omit<FeedbackPayload, "website"> {
    feedback_id: string;
    status: FeedbackStatus;
    created_at: string;
    triage_note?: string;
    triaged_by?: string;
    triaged_at?: string;
    client_ip?: string | null;
}
