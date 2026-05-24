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
    IngestionJob,
    IngestionRepository,
    DraftPayload,
} from "./ingestion-types.js";
import type { ContentWriteRepository } from "./content-writer.js";

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

            // 2. Build pages with safe defaults
            const pages = (d.pages ?? []).map((p) => ({
                id: `${d.seriesId}-${d.episodeId}-p${String(p.pageNumber).padStart(2, "0")}`,
                pageNumber: p.pageNumber,
                images: { ja: p.imagePath ?? "" } as Record<string, string | undefined>,
                width: p.width ?? 500,
                height: p.height ?? 760,
                panels: (p.panels ?? []).map((pn) => ({
                    id: `${d.seriesId}-${d.episodeId}-p${String(p.pageNumber).padStart(2, "0")}-pnl${pn.panelNumber}`,
                    panelNumber: pn.panelNumber,
                    bbox: pn.bbox ?? { x: 0, y: 0, width: 100, height: 100 },
                    reactionTags: pn.reactionTags ?? [],
                    bubbles: (pn.bubbles ?? []).map((b) => ({
                        id: `${d.seriesId}-${d.episodeId}-p${String(p.pageNumber).padStart(2, "0")}-pnl${pn.panelNumber}-b${b.bubbleNumber}`,
                        shortId: `b${b.bubbleNumber}`,
                        bubbleNumber: b.bubbleNumber,
                        bubbleType: b.bubbleType ?? "speech",
                        textOriginal: b.textOriginal ?? "",
                        speaker: b.speaker,
                        bbox: { x: 0, y: 0, width: 100, height: 40 },
                    })),
                })),
            }));

            const epResult = this.writer.saveEpisode(d.seriesId, {
                id: d.episodeId,
                episodeNumber: d.episodeNumber,
                title: d.episodeTitle,
                pages: pages as any,
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
