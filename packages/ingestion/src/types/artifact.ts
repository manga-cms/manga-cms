import type {
    BoundingBox,
    BubbleClassification,
    InputSourceKind,
    RegionKind,
} from "./bbox.js";

export interface ArtifactMetadata {
    artifact_version: string;
    provider: string;
    model: string;
    created_at: string;
    prompt_version?: string;
    run_id?: string;
    finished_at?: string;
    temperature?: number;
    latency_ms?: number;
}

interface BaseArtifact {
    artifact_id: string;
    page_id: string;
    bbox: BoundingBox;
    confidence: number;
    source: InputSourceKind;
    metadata: ArtifactMetadata;
}

export interface RegionArtifact extends BaseArtifact {
    artifact_type: "region";
    region_kind: RegionKind;
    classification?: BubbleClassification;
    parent_artifact_id?: string;
}

export interface AlignmentArtifact extends BaseArtifact {
    artifact_type: "alignment";
    bubble_candidate_id: string;
    panel_candidate_id?: string;
    selected_text: string;
    ocr_text?: string;
    source_text?: string;
    source_record_id?: string;
    classification: BubbleClassification;
}

export interface OCRArtifact extends BaseArtifact {
    artifact_type: "ocr";
    text: string;
    language?: string;
}

export type RegionCandidate = RegionArtifact;
export type OCRTextCandidate = OCRArtifact;
export type TextAlignmentCandidate = AlignmentArtifact;

export interface ArtifactDiagnostic {
    level: "info" | "warning" | "error";
    code: string;
    message: string;
}

export interface ArtifactEnvelope<TStage extends string, TPayload> {
    layer: "artifact";
    stage: TStage;
    pageId: string;
    metadata: ArtifactMetadata;
    diagnostics: ArtifactDiagnostic[];
    payload: TPayload;
}

export interface DraftBuildCandidate {
    panelCandidateId: string;
    panelConfidence: number;
    reactionTags: string[];
    bubbles: Array<{
        bubbleCandidateId: string;
        bubbleConfidence: number;
        classification: BubbleClassification;
        textOriginal: string;
        speaker?: string;
    }>;
}

export type RegionDetectionArtifact = ArtifactEnvelope<
    "detect_regions",
    {
        candidates: RegionArtifact[];
        ocrCandidates?: OCRArtifact[];
    }
>;

export type TextAlignmentArtifact = ArtifactEnvelope<
    "align_text",
    {
        alignments: AlignmentArtifact[];
    }
>;

export type DraftBuildArtifact = ArtifactEnvelope<
    "build_draft",
    {
        pageImagePath: string;
        width?: number;
        height?: number;
        panels: DraftBuildCandidate[];
    }
>;

export interface PageArtifactBundle {
    layer: "artifact";
    pageId: string;
    regionDetection?: RegionDetectionArtifact;
    textAlignment?: TextAlignmentArtifact;
    draftBuild?: DraftBuildArtifact;
}
