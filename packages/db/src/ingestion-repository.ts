/**
 * DB-backed IngestionRepository using Prisma.
 *
 * Stores draft as JSON blob. Confirm delegates to ContentWriteRepository.
 */

import type { PrismaClient } from "@prisma/client";
import type {
    IngestionJob,
    IngestionRepository,
    IngestionReviewCandidate,
    IngestionReviewDecision,
    DraftPayload,
} from "@manga/domain";
import {
    applyReviewDecision,
    applyReviewedDraft,
    buildEpisodePagesFromDraft,
    getDraftReviewCandidates,
    type ContentWriteRepository,
} from "@manga/domain";

export class DbIngestionRepository implements IngestionRepository {
    constructor(
        private prisma: PrismaClient,
        private writer: ContentWriteRepository,
    ) { }

    private toJob(row: any): IngestionJob {
        return {
            id: row.id,
            status: row.status,
            createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
            updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
            label: row.label,
            draft: row.draftJson ? JSON.parse(row.draftJson) : null,
            errorMessage: row.errorMessage ?? undefined,
        };
    }

    async createJob(label: string, draft?: DraftPayload): Promise<IngestionJob> {
        const id = Math.random().toString(36).slice(2, 10);
        const row = await this.prisma.ingestionJob.create({
            data: {
                id,
                label,
                status: draft ? "draft" : "queued",
                draftJson: draft ? JSON.stringify(draft) : null,
            },
        });
        return this.toJob(row);
    }

    async getJob(jobId: string): Promise<IngestionJob | undefined> {
        const row = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
        return row ? this.toJob(row) : undefined;
    }

    async listJobs(): Promise<IngestionJob[]> {
        const rows = await this.prisma.ingestionJob.findMany({
            orderBy: { createdAt: "desc" },
        });
        return rows.map(this.toJob);
    }

    async updateDraft(jobId: string, draft: DraftPayload): Promise<{ success: true } | { success: false; error: string }> {
        const row = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
        if (!row) return { success: false, error: "Job not found" };
        if (row.status !== "queued" && row.status !== "draft") {
            return { success: false, error: `Cannot update draft in status "${row.status}"` };
        }
        // Validate required fields
        if (!draft.seriesId || !draft.seriesTitle || !draft.episodeId || !draft.episodeTitle) {
            return { success: false, error: "Missing required draft fields" };
        }
        if (typeof draft.episodeNumber !== "number" || draft.episodeNumber < 1) {
            return { success: false, error: "episodeNumber must be a positive number" };
        }
        if (!Array.isArray(draft.pages)) {
            return { success: false, error: "pages must be an array" };
        }
        await this.prisma.ingestionJob.update({
            where: { id: jobId },
            data: { status: "draft", draftJson: JSON.stringify(draft) },
        });
        return { success: true };
    }

    async getReviewCandidates(jobId: string): Promise<{ success: true; candidates: IngestionReviewCandidate[] } | { success: false; error: string }> {
        const row = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
        if (!row) return { success: false, error: "Job not found" };
        if (!row.draftJson) return { success: false, error: "No draft payload to review" };
        return { success: true, candidates: getDraftReviewCandidates(JSON.parse(row.draftJson) as DraftPayload) };
    }

    async setReviewDecision(
        jobId: string,
        decision: Omit<IngestionReviewDecision, "key" | "updatedAt"> & { updatedAt?: string },
    ): Promise<{ success: true; candidates: IngestionReviewCandidate[] } | { success: false; error: string }> {
        const row = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
        if (!row) return { success: false, error: "Job not found" };
        if (!row.draftJson) return { success: false, error: "No draft payload to review" };
        const result = applyReviewDecision(JSON.parse(row.draftJson) as DraftPayload, decision);
        if (!result.success) return result;
        await this.prisma.ingestionJob.update({
            where: { id: jobId },
            data: { draftJson: JSON.stringify(result.draft) },
        });
        return { success: true, candidates: result.candidates };
    }

    async writeReviewedDraft(jobId: string): Promise<{ success: true; draft: DraftPayload } | { success: false; error: string }> {
        const row = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
        if (!row) return { success: false, error: "Job not found" };
        if (!row.draftJson) return { success: false, error: "No draft payload to review" };
        if (row.status !== "draft" && row.status !== "waiting_review") {
            return { success: false, error: `Cannot write reviewed draft from status "${row.status}"` };
        }
        const result = applyReviewedDraft(JSON.parse(row.draftJson) as DraftPayload);
        if (!result.success) return result;
        await this.prisma.ingestionJob.update({
            where: { id: jobId },
            data: { draftJson: JSON.stringify(result.draft) },
        });
        return { success: true, draft: result.draft };
    }

    async submitForReview(jobId: string): Promise<{ success: true } | { success: false; error: string }> {
        const row = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
        if (!row) return { success: false, error: "Job not found" };
        if (!row.draftJson) return { success: false, error: "No draft payload to review" };
        if (row.status !== "draft") {
            return { success: false, error: `Cannot submit for review from status "${row.status}"` };
        }
        await this.prisma.ingestionJob.update({
            where: { id: jobId },
            data: { status: "waiting_review" },
        });
        return { success: true };
    }

    async confirmJob(jobId: string): Promise<{ success: true; seriesId: string } | { success: false; error: string }> {
        const row = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
        if (!row) return { success: false, error: "Job not found" };
        if (!row.draftJson) return { success: false, error: "No draft to confirm" };
        if (row.status !== "waiting_review") {
            return { success: false, error: `Cannot confirm from status "${row.status}"` };
        }

        const d: DraftPayload = JSON.parse(row.draftJson);

        try {
            // Create or update series
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

            const pageResult = buildEpisodePagesFromDraft(d);
            if (!pageResult.success) throw new Error(pageResult.error);

            const epResult = this.writer.saveEpisode(d.seriesId, {
                id: d.episodeId,
                episodeNumber: d.episodeNumber,
                title: d.episodeTitle,
                pages: pageResult.pages as any,
            });

            if (!epResult.success) throw new Error(epResult.error);

            await this.prisma.ingestionJob.update({
                where: { id: jobId },
                data: { status: "confirmed" },
            });
            this.writer.reload();
            return { success: true, seriesId: d.seriesId };

        } catch (err: unknown) {
            await this.prisma.ingestionJob.update({
                where: { id: jobId },
                data: {
                    status: "failed",
                    errorMessage: err instanceof Error ? err.message : String(err),
                },
            });
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    }

    async cancelJob(jobId: string): Promise<{ success: true } | { success: false; error: string }> {
        const row = await this.prisma.ingestionJob.findUnique({ where: { id: jobId } });
        if (!row) return { success: false, error: "Job not found" };
        if (row.status === "confirmed") {
            return { success: false, error: "Cannot cancel a confirmed job" };
        }
        await this.prisma.ingestionJob.update({
            where: { id: jobId },
            data: { status: "canceled" },
        });
        return { success: true };
    }
}
