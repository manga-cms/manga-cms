import { createArtifactBundle, withDraftBuild, withRegionDetection, withTextAlignment } from "../artifacts/index.js";
import { buildCanonicalDraft } from "../drafts/index.js";
import type { ArtifactStore } from "../artifacts/index.js";
import type {
    IngestionPoCJob,
    IngestionPoCResult,
    IngestionLLMProvider,
    PageArtifactBundle,
    PipelineStageResult,
} from "../types/index.js";

function startedStage(stage: PipelineStageResult["stage"], pageCount: number): PipelineStageResult {
    const now = new Date().toISOString();
    return {
        stage,
        startedAt: now,
        finishedAt: now,
        pageCount,
    };
}

export async function runPoCPipeline(
    job: IngestionPoCJob,
    provider: IngestionLLMProvider,
    artifactStore: ArtifactStore,
): Promise<IngestionPoCResult> {
    const artifacts: PageArtifactBundle[] = [];
    const stages: PipelineStageResult[] = [startedStage("normalize", job.input.pages.length)];

    for (const page of job.input.pages) {
        let bundle = createArtifactBundle(page.page.pageId);

        const regionArtifact = await provider.detectRegions({ page });
        bundle = withRegionDetection(bundle, regionArtifact);

        const alignmentArtifact = await provider.alignText({
            page,
            regionArtifact,
        });
        bundle = withTextAlignment(bundle, alignmentArtifact);

        const draftArtifact = await provider.buildDraft({
            page,
            regionArtifact,
            alignmentArtifact,
        });
        bundle = withDraftBuild(bundle, draftArtifact);

        await artifactStore.put(bundle);
        artifacts.push(bundle);
    }

    stages.push(startedStage("detect_regions", job.input.pages.length));
    stages.push(startedStage("align_text", job.input.pages.length));
    stages.push(startedStage("build_draft", job.input.pages.length));

    const canonicalDraft = buildCanonicalDraft(job.input, artifacts);
    stages.push(startedStage("review_ready", job.input.pages.length));

    return {
        jobId: job.id,
        artifacts,
        canonicalDraft,
        stages,
    };
}
