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
    bubbleType: "speech" | "thought" | "narration" | "sfx";
    textOriginal: string;
    speaker?: string;
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
    submitForReview(jobId: string): ({ success: true } | { success: false; error: string }) | Promise<{ success: true } | { success: false; error: string }>;
    confirmJob(jobId: string): ({ success: true; seriesId: string } | { success: false; error: string }) | Promise<{ success: true; seriesId: string } | { success: false; error: string }>;
    cancelJob(jobId: string): ({ success: true } | { success: false; error: string }) | Promise<{ success: true } | { success: false; error: string }>;
}
