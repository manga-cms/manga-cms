import type {
    AlignTextInput,
    BuildDraftInput,
    DetectRegionsInput,
    DraftBuildArtifact,
    IngestionLLMProvider,
    RegionDetectionArtifact,
    TextAlignmentArtifact,
} from "../types/index.js";

function now(): string {
    return new Date().toISOString();
}

export class NoopIngestionProvider implements IngestionLLMProvider {
    readonly providerId = "noop";

    async detectRegions(input: DetectRegionsInput): Promise<RegionDetectionArtifact> {
        return {
            layer: "artifact",
            stage: "detect_regions",
            pageId: input.page.page.pageId,
            metadata: {
                artifact_version: "0.1.0",
                provider: this.providerId,
                model: "noop",
                created_at: now(),
                run_id: `${input.page.page.pageId}-detect`,
                finished_at: now(),
            },
            diagnostics: [
                {
                    level: "warning",
                    code: "NOOP_PROVIDER",
                    message: "Noop provider returns empty region candidates.",
                },
            ],
            payload: {
                candidates: [],
                ocrCandidates: [],
            },
        };
    }

    async alignText(input: AlignTextInput): Promise<TextAlignmentArtifact> {
        return {
            layer: "artifact",
            stage: "align_text",
            pageId: input.page.page.pageId,
            metadata: {
                artifact_version: "0.1.0",
                provider: this.providerId,
                model: "noop",
                created_at: now(),
                run_id: `${input.page.page.pageId}-align`,
                finished_at: now(),
            },
            diagnostics: [
                {
                    level: "warning",
                    code: "NOOP_PROVIDER",
                    message: "Noop provider returns empty alignments.",
                },
            ],
            payload: {
                alignments: [],
            },
        };
    }

    async buildDraft(input: BuildDraftInput): Promise<DraftBuildArtifact> {
        return {
            layer: "artifact",
            stage: "build_draft",
            pageId: input.page.page.pageId,
            metadata: {
                artifact_version: "0.1.0",
                provider: this.providerId,
                model: "noop",
                created_at: now(),
                run_id: `${input.page.page.pageId}-draft`,
                finished_at: now(),
            },
            diagnostics: [
                {
                    level: "warning",
                    code: "NOOP_PROVIDER",
                    message: "Noop provider returns an empty page draft candidate.",
                },
            ],
            payload: {
                pageImagePath: input.page.page.imagePath,
                width: input.page.page.width,
                height: input.page.page.height,
                panels: [],
            },
        };
    }
}
