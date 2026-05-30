/**
 * Ingestion job types and draft model.
 *
 * An ingestion job tracks the lifecycle of content intake:
 *   queued → draft → waiting_review → confirmed | failed | canceled
 *
 * Drafts are stored separately from contents/ and only written
 * to the source-of-truth on confirm.
 */

// ---------------------------------------------------------------------------
// Job status
// ---------------------------------------------------------------------------

export type IngestionJobStatus =
    | "queued"
    | "draft"
    | "waiting_review"
    | "confirmed"
    | "failed"
    | "canceled";

// ---------------------------------------------------------------------------
// Draft payload — what the job produces before confirm
// ---------------------------------------------------------------------------

export interface DraftPage {
    pageNumber: number;
    imagePath: string;
    width: number;
    height: number;
    displayRef?: string;
    panels: DraftPanel[];
}

export interface DraftPanel {
    panelNumber: number;
    bbox: { x: number; y: number; width: number; height: number };
    reactionTags: string[];
    bubbles: DraftBubble[];
}

export interface DraftBubble {
    bubbleNumber: number;
    bubbleType: "speech" | "thought" | "narration" | "sfx" | "caption" | "other";
    textOriginal: string;
    speaker?: string;
    bbox?: { x: number; y: number; width: number; height: number };
    shortId?: string;
    speakerConfidence?: "confirmed" | "inferred" | "unknown";
    textDirection?: "horizontal" | "vertical";
    lang?: string;
    flags?: {
        shareable: boolean;
        feedback_enabled: boolean;
        contains_spoiler?: boolean;
    };
}

export type IngestionReviewDecisionValue = "pending" | "accepted" | "rejected";
export type IngestionReviewCandidateKind = "panel" | "bubble";

export interface IngestionReviewTarget {
    kind: IngestionReviewCandidateKind;
    pageNumber: number;
    panelNumber: number;
    bubbleNumber?: number;
}

export interface IngestionReviewDecision {
    key: string;
    target: IngestionReviewTarget;
    decision: IngestionReviewDecisionValue;
    note?: string;
    reviewerId?: string;
    updatedAt: string;
}

export interface IngestionReviewCandidate {
    key: string;
    target: IngestionReviewTarget;
    decision: IngestionReviewDecisionValue;
    panel?: DraftPanel;
    bubble?: DraftBubble;
}

export interface DraftPayload {
    seriesId: string;
    seriesTitle: string;
    seriesDescription?: string;
    seriesStatus?: "ongoing" | "completed" | "hiatus";
    episodeId: string;
    episodeNumber: number;
    episodeTitle: string;
    pages: DraftPage[];
    reviewDecisions?: IngestionReviewDecision[];
}

// ---------------------------------------------------------------------------
// Ingestion job
// ---------------------------------------------------------------------------

export interface IngestionJob {
    id: string;
    status: IngestionJobStatus;
    createdAt: string;
    updatedAt: string;
    /** Human-readable label for display. */
    label: string;
    draft: DraftPayload | null;
    /** Error message if status is 'failed'. */
    errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface IngestionRepository {
    createJob(label: string, draft?: DraftPayload): IngestionJob | Promise<IngestionJob>;
    getJob(jobId: string): IngestionJob | undefined | Promise<IngestionJob | undefined>;
    listJobs(): IngestionJob[] | Promise<IngestionJob[]>;
    updateDraft(jobId: string, draft: DraftPayload): ({ success: true } | { success: false; error: string }) | Promise<{ success: true } | { success: false; error: string }>;
    getReviewCandidates(jobId: string): ({ success: true; candidates: IngestionReviewCandidate[] } | { success: false; error: string }) | Promise<{ success: true; candidates: IngestionReviewCandidate[] } | { success: false; error: string }>;
    setReviewDecision(jobId: string, decision: Omit<IngestionReviewDecision, "key" | "updatedAt"> & { updatedAt?: string }): ({ success: true; candidates: IngestionReviewCandidate[] } | { success: false; error: string }) | Promise<{ success: true; candidates: IngestionReviewCandidate[] } | { success: false; error: string }>;
    writeReviewedDraft(jobId: string): ({ success: true; draft: DraftPayload } | { success: false; error: string }) | Promise<{ success: true; draft: DraftPayload } | { success: false; error: string }>;
    submitForReview(jobId: string): ({ success: true } | { success: false; error: string }) | Promise<{ success: true } | { success: false; error: string }>;
    confirmJob(jobId: string): ({ success: true; seriesId: string } | { success: false; error: string }) | Promise<{ success: true; seriesId: string } | { success: false; error: string }>;
    cancelJob(jobId: string): ({ success: true } | { success: false; error: string }) | Promise<{ success: true } | { success: false; error: string }>;
}
