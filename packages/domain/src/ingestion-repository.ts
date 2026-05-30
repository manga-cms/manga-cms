/**
 * Filesystem-backed ingestion repository.
 *
 * Stores jobs as JSON in `drafts/` directory.
 * On confirm, writes to `contents/` via ContentWriteRepository.
 *
 * Layout:
 *   drafts/
 *     {jobId}.json    ← IngestionJob serialized
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
    DraftBubble,
    DraftPage,
    DraftPanel,
    IngestionJob,
    IngestionRepository,
    IngestionReviewCandidate,
    IngestionReviewDecision,
    IngestionReviewTarget,
    DraftPayload,
} from "./ingestion-types.js";
import type { ContentWriteRepository } from "./content-writer.js";

export function ingestionReviewKey(target: IngestionReviewTarget): string {
    const base = `p${target.pageNumber}:panel${target.panelNumber}`;
    return target.kind === "panel" ? `panel:${base}` : `bubble:${base}:bubble${target.bubbleNumber}`;
}

export function getDraftReviewCandidates(draft: DraftPayload): IngestionReviewCandidate[] {
    const decisions = new Map((draft.reviewDecisions ?? []).map((decision) => [decision.key, decision]));
    const candidates: IngestionReviewCandidate[] = [];

    for (const page of draft.pages ?? []) {
        for (const panel of page.panels ?? []) {
            const panelTarget: IngestionReviewTarget = {
                kind: "panel",
                pageNumber: page.pageNumber,
                panelNumber: panel.panelNumber,
            };
            const panelKey = ingestionReviewKey(panelTarget);
            candidates.push({
                key: panelKey,
                target: panelTarget,
                decision: decisions.get(panelKey)?.decision ?? "pending",
                panel,
            });

            for (const bubble of panel.bubbles ?? []) {
                const bubbleTarget: IngestionReviewTarget = {
                    kind: "bubble",
                    pageNumber: page.pageNumber,
                    panelNumber: panel.panelNumber,
                    bubbleNumber: bubble.bubbleNumber,
                };
                const bubbleKey = ingestionReviewKey(bubbleTarget);
                candidates.push({
                    key: bubbleKey,
                    target: bubbleTarget,
                    decision: decisions.get(bubbleKey)?.decision ?? "pending",
                    panel,
                    bubble,
                });
            }
        }
    }

    return candidates;
}

export function applyReviewDecision(
    draft: DraftPayload,
    input: Omit<IngestionReviewDecision, "key" | "updatedAt"> & { updatedAt?: string },
): { success: true; draft: DraftPayload; candidates: IngestionReviewCandidate[] } | { success: false; error: string } {
    const key = ingestionReviewKey(input.target);
    const candidates = getDraftReviewCandidates(draft);
    if (!candidates.some((candidate) => candidate.key === key)) {
        return { success: false, error: `Review target "${key}" does not exist in draft` };
    }

    const now = input.updatedAt ?? new Date().toISOString();
    const nextDecision: IngestionReviewDecision = {
        key,
        target: input.target,
        decision: input.decision,
        ...(input.note !== undefined && { note: input.note }),
        ...(input.reviewerId !== undefined && { reviewerId: input.reviewerId }),
        updatedAt: now,
    };
    const decisions = new Map((draft.reviewDecisions ?? []).map((decision) => [decision.key, decision]));
    decisions.set(key, nextDecision);
    const nextDraft = { ...draft, reviewDecisions: [...decisions.values()] };
    return { success: true, draft: nextDraft, candidates: getDraftReviewCandidates(nextDraft) };
}

export function applyReviewedDraft(
    draft: DraftPayload,
): { success: true; draft: DraftPayload } | { success: false; error: string } {
    const candidates = getDraftReviewCandidates(draft);
    const pending = candidates.filter((candidate) => candidate.decision === "pending");
    if (pending.length > 0) {
        return { success: false, error: `${pending.length} review candidate(s) are still pending` };
    }

    const decisionByKey = new Map(candidates.map((candidate) => [candidate.key, candidate.decision]));
    const pages: DraftPage[] = draft.pages.map((page) => {
        const acceptedPanels: DraftPanel[] = [];

        for (const panel of page.panels ?? []) {
            const panelKey = ingestionReviewKey({
                kind: "panel",
                pageNumber: page.pageNumber,
                panelNumber: panel.panelNumber,
            });
            if (decisionByKey.get(panelKey) !== "accepted") continue;

            const acceptedBubbles = (panel.bubbles ?? []).filter((bubble) => {
                const bubbleKey = ingestionReviewKey({
                    kind: "bubble",
                    pageNumber: page.pageNumber,
                    panelNumber: panel.panelNumber,
                    bubbleNumber: bubble.bubbleNumber,
                });
                return decisionByKey.get(bubbleKey) === "accepted";
            });

            const nextPanelNumber = acceptedPanels.length + 1;
            acceptedPanels.push({
                ...panel,
                panelNumber: nextPanelNumber,
                bubbles: acceptedBubbles.map((bubble, index) => ({
                    ...bubble,
                    bubbleNumber: index + 1,
                })),
            });
        }

        return { ...page, panels: acceptedPanels };
    });

    const { reviewDecisions: _reviewDecisions, ...draftWithoutReview } = draft;
    return { success: true, draft: { ...draftWithoutReview, pages } };
}

export function buildEpisodePagesFromDraft(draft: DraftPayload) {
    const reviewed = draft.reviewDecisions?.length ? applyReviewedDraft(draft) : { success: true as const, draft };
    if (!reviewed.success) return reviewed;
    const d = reviewed.draft;

    return {
        success: true as const,
        pages: (d.pages ?? []).map((p) => ({
            id: `${d.seriesId}-${d.episodeId}-p${String(p.pageNumber).padStart(2, "0")}`,
            pageNumber: p.pageNumber,
            displayRef: p.displayRef,
            images: { ja: p.imagePath ?? "" } as Record<string, string | undefined>,
            width: p.width ?? 500,
            height: p.height ?? 760,
            panels: (p.panels ?? []).map((pn) => ({
                id: `${d.seriesId}-${d.episodeId}-p${String(p.pageNumber).padStart(2, "0")}-pnl${pn.panelNumber}`,
                panelNumber: pn.panelNumber,
                bbox: pn.bbox ?? { x: 0, y: 0, width: 100, height: 100 },
                reactionTags: pn.reactionTags ?? [],
                bubbles: (pn.bubbles ?? []).map((b: DraftBubble) => ({
                    id: `${d.seriesId}-${d.episodeId}-p${String(p.pageNumber).padStart(2, "0")}-pnl${pn.panelNumber}-b${b.bubbleNumber}`,
                    shortId: b.shortId ?? `b${b.bubbleNumber}`,
                    bubbleNumber: b.bubbleNumber,
                    bubbleType: b.bubbleType ?? "speech",
                    textOriginal: b.textOriginal ?? "",
                    speaker: b.speaker,
                    speakerConfidence: b.speakerConfidence,
                    textDirection: b.textDirection,
                    lang: b.lang,
                    flags: b.flags,
                    bbox: b.bbox ?? { x: 0, y: 0, width: 100, height: 40 },
                })),
            })),
        })),
    };
}

export class FileIngestionRepository implements IngestionRepository {
    constructor(
        private draftsDir: string,
        private writer: ContentWriteRepository,
    ) {
        mkdirSync(this.draftsDir, { recursive: true });
    }

    private jobPath(jobId: string): string {
        return join(this.draftsDir, `${jobId}.json`);
    }

    private saveJob(job: IngestionJob): void {
        writeFileSync(this.jobPath(job.id), JSON.stringify(job, null, 2) + "\n", "utf-8");
    }

    private loadJob(jobId: string): IngestionJob | undefined {
        const p = this.jobPath(jobId);
        if (!existsSync(p)) return undefined;
        return JSON.parse(readFileSync(p, "utf-8"));
    }

    createJob(label: string, draft?: DraftPayload): IngestionJob {
        const now = new Date().toISOString();
        const job: IngestionJob = {
            id: randomUUID().slice(0, 8),
            status: draft ? "draft" : "queued",
            createdAt: now,
            updatedAt: now,
            label,
            draft: draft ?? null,
        };
        this.saveJob(job);
        return job;
    }

    getJob(jobId: string): IngestionJob | undefined {
        return this.loadJob(jobId);
    }

    listJobs(): IngestionJob[] {
        if (!existsSync(this.draftsDir)) return [];
        return readdirSync(this.draftsDir)
            .filter((f: string) => f.endsWith(".json"))
            .map((f: string) => {
                const raw = readFileSync(join(this.draftsDir, f), "utf-8");
                return JSON.parse(raw) as IngestionJob;
            })
            .sort((a: IngestionJob, b: IngestionJob) =>
                b.createdAt.localeCompare(a.createdAt),
            );
    }

    updateDraft(jobId: string, draft: DraftPayload): { success: true } | { success: false; error: string } {
        const job = this.loadJob(jobId);
        if (!job) return { success: false, error: "Job not found" };
        if (job.status !== "queued" && job.status !== "draft") {
            return { success: false, error: `Cannot update draft in status "${job.status}"` };
        }
        // Validate required fields
        if (!draft.seriesId || typeof draft.seriesId !== "string") {
            return { success: false, error: "draft.seriesId is required" };
        }
        if (!draft.seriesTitle || typeof draft.seriesTitle !== "string") {
            return { success: false, error: "draft.seriesTitle is required" };
        }
        if (!draft.episodeId || typeof draft.episodeId !== "string") {
            return { success: false, error: "draft.episodeId is required" };
        }
        if (!draft.episodeTitle || typeof draft.episodeTitle !== "string") {
            return { success: false, error: "draft.episodeTitle is required" };
        }
        if (typeof draft.episodeNumber !== "number" || draft.episodeNumber < 1) {
            return { success: false, error: "draft.episodeNumber must be a positive number" };
        }
        if (!Array.isArray(draft.pages)) {
            return { success: false, error: "draft.pages must be an array" };
        }
        job.draft = draft;
        job.status = "draft";
        job.updatedAt = new Date().toISOString();
        this.saveJob(job);
        return { success: true };
    }

    getReviewCandidates(jobId: string): { success: true; candidates: IngestionReviewCandidate[] } | { success: false; error: string } {
        const job = this.loadJob(jobId);
        if (!job) return { success: false, error: "Job not found" };
        if (!job.draft) return { success: false, error: "No draft payload to review" };
        return { success: true, candidates: getDraftReviewCandidates(job.draft) };
    }

    setReviewDecision(
        jobId: string,
        decision: Omit<IngestionReviewDecision, "key" | "updatedAt"> & { updatedAt?: string },
    ): { success: true; candidates: IngestionReviewCandidate[] } | { success: false; error: string } {
        const job = this.loadJob(jobId);
        if (!job) return { success: false, error: "Job not found" };
        if (!job.draft) return { success: false, error: "No draft payload to review" };
        const result = applyReviewDecision(job.draft, decision);
        if (!result.success) return result;
        job.draft = result.draft;
        job.updatedAt = new Date().toISOString();
        this.saveJob(job);
        return { success: true, candidates: result.candidates };
    }

    writeReviewedDraft(jobId: string): { success: true; draft: DraftPayload } | { success: false; error: string } {
        const job = this.loadJob(jobId);
        if (!job) return { success: false, error: "Job not found" };
        if (!job.draft) return { success: false, error: "No draft payload to review" };
        if (job.status !== "draft" && job.status !== "waiting_review") {
            return { success: false, error: `Cannot write reviewed draft from status "${job.status}"` };
        }
        const result = applyReviewedDraft(job.draft);
        if (!result.success) return result;
        job.draft = result.draft;
        job.updatedAt = new Date().toISOString();
        this.saveJob(job);
        return { success: true, draft: job.draft };
    }

    submitForReview(jobId: string): { success: true } | { success: false; error: string } {
        const job = this.loadJob(jobId);
        if (!job) return { success: false, error: "Job not found" };
        if (!job.draft) return { success: false, error: "No draft payload to review" };
        if (job.status !== "draft") {
            return { success: false, error: `Cannot submit for review from status "${job.status}"` };
        }
        job.status = "waiting_review";
        job.updatedAt = new Date().toISOString();
        this.saveJob(job);
        return { success: true };
    }

    confirmJob(jobId: string): { success: true; seriesId: string } | { success: false; error: string } {
        const job = this.loadJob(jobId);
        if (!job) return { success: false, error: "Job not found" };
        if (!job.draft) return { success: false, error: "No draft to confirm" };
        if (job.status !== "waiting_review") {
            return { success: false, error: `Cannot confirm from status "${job.status}"` };
        }

        const d = job.draft;

        try {
            // 1. Create or update series
            const existing = this.writer.createSeries({
                id: d.seriesId,
                title: d.seriesTitle,
                description: d.seriesDescription,
                status: d.seriesStatus,
            });
            if (!existing.success && existing.error.includes("already exists")) {
                const updateResult = this.writer.updateSeries(d.seriesId, {
                    title: d.seriesTitle,
                    description: d.seriesDescription,
                    status: d.seriesStatus,
                });
                if (!updateResult.success) {
                    throw new Error(`Series metadata update failed: ${updateResult.error}`);
                }
            } else if (!existing.success) {
                throw new Error(existing.error);
            }

            // 2. Build pages with safe defaults. If review decisions exist, only
            // accepted candidates are allowed into canonical content.
            const pageResult = buildEpisodePagesFromDraft(d);
            if (!pageResult.success) throw new Error(pageResult.error);

            const epResult = this.writer.saveEpisode(d.seriesId, {
                id: d.episodeId,
                episodeNumber: d.episodeNumber,
                title: d.episodeTitle,
                pages: pageResult.pages as any,
            });

            if (!epResult.success) {
                throw new Error(epResult.error);
            }

            // Mark confirmed
            job.status = "confirmed";
            job.updatedAt = new Date().toISOString();
            this.saveJob(job);
            this.writer.reload();
            return { success: true, seriesId: d.seriesId };

        } catch (err: unknown) {
            job.status = "failed";
            job.errorMessage = err instanceof Error ? err.message : String(err);
            job.updatedAt = new Date().toISOString();
            this.saveJob(job);
            return { success: false, error: job.errorMessage };
        }
    }

    cancelJob(jobId: string): { success: true } | { success: false; error: string } {
        const job = this.loadJob(jobId);
        if (!job) return { success: false, error: "Job not found" };
        if (job.status === "confirmed") {
            return { success: false, error: "Cannot cancel a confirmed job" };
        }
        job.status = "canceled";
        job.updatedAt = new Date().toISOString();
        this.saveJob(job);
        return { success: true };
    }
}

export function createFileIngestionRepository(
    draftsDir: string,
    writer: ContentWriteRepository,
): IngestionRepository {
    return new FileIngestionRepository(draftsDir, writer);
}
