import type { IngestionJobStatus } from "@manga/domain";

import type { PageArtifactBundle } from "./artifact.js";
import type { CanonicalDraftEnvelope } from "./draft.js";
import type { EpisodeInput } from "./input.js";
import type { PipelineMetricsSnapshot } from "../metrics/types.js";

export type PoCPipelineStage =
    | "normalize"
    | "detect_regions"
    | "align_text"
    | "build_draft"
    | "review_ready";

export interface IngestionPoCJob {
    id: string;
    label: string;
    createdAt: string;
    status: IngestionJobStatus;
    input: EpisodeInput;
}

export interface PipelineStageResult {
    stage: PoCPipelineStage;
    startedAt: string;
    finishedAt: string;
    pageCount: number;
}

export interface IngestionPoCResult {
    jobId: string;
    artifacts: PageArtifactBundle[];
    canonicalDraft: CanonicalDraftEnvelope;
    stages: PipelineStageResult[];
    metrics?: PipelineMetricsSnapshot;
}
