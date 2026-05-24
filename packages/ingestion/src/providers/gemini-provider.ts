import { z } from "zod";

import {
    AlignmentArtifactSchema,
    OCRArtifactSchema,
    PageDraftSchema,
    RegionArtifactSchema,
} from "../schemas/index.js";
import type {
    AlignmentArtifact,
    AlignTextInput,
    BuildDraftInput,
    DetectRegionsInput,
    DraftBuildArtifact,
    IngestionLLMProvider,
    OCRArtifact,
    PageDraft,
    RegionArtifact,
    RegionDetectionArtifact,
    TextAlignmentArtifact,
} from "../types/index.js";
import {
    bubbleCandidateId,
    clampConfidence,
    pageIdFromNumber,
    panelCandidateId,
} from "../utils/index.js";

const GEMINI_ARTIFACT_VERSION = "poc-v1";
const GEMINI_PROVIDER_ID = "gemini";
const GEMINI_MODEL = "gemini-2.0-flash";

const RegionArtifactsSchema = z.array(RegionArtifactSchema);
const AlignmentArtifactsSchema = z.array(AlignmentArtifactSchema);
const OCRArtifactsSchema = z.array(OCRArtifactSchema);

function now(): string {
    return new Date().toISOString();
}

function fixtureMetadata(pageId: string, stage: string) {
    const createdAt = now();
    return {
        artifact_version: GEMINI_ARTIFACT_VERSION,
        provider: GEMINI_PROVIDER_ID,
        model: GEMINI_MODEL,
        created_at: createdAt,
        prompt_version: "stub-fixture-v1",
        run_id: `${pageId}-${stage}`,
        finished_at: createdAt,
    };
}

function deterministicOffset(seed: string, modulo: number, base = 0): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return base + (hash % modulo);
}

function buildRegionArtifacts(input: DetectRegionsInput): {
    regions: RegionArtifact[];
    ocrArtifacts: OCRArtifact[];
} {
    const { page } = input;
    const pageId = page.page.pageId || pageIdFromNumber(page.episodeId, page.page.pageNumber);
    const width = page.page.width ?? 1600;
    const height = page.page.height ?? 2400;
    const metadata = fixtureMetadata(pageId, "detect-regions");

    const leftPanelWidth = Math.floor(width * 0.48);
    const rightPanelWidth = width - leftPanelWidth - 48;
    const topPanelHeight = Math.floor(height * 0.52);

    const panelAId = panelCandidateId(pageId, 1);
    const panelBId = panelCandidateId(pageId, 2);
    const bubbleAId = bubbleCandidateId(pageId, 1, 1);
    const bubbleBId = bubbleCandidateId(pageId, 2, 1);
    const textRegionId = `${pageId}-t001`;

    const regions: RegionArtifact[] = [
        {
            artifact_id: panelAId,
            artifact_type: "region",
            page_id: pageId,
            region_kind: "panel",
            bbox: { x: 0, y: 0, width: leftPanelWidth, height: topPanelHeight },
            confidence: clampConfidence(0.94),
            source: "page_image",
            metadata,
        },
        {
            artifact_id: panelBId,
            artifact_type: "region",
            page_id: pageId,
            region_kind: "panel",
            bbox: {
                x: leftPanelWidth + 48,
                y: Math.floor(height * 0.18),
                width: rightPanelWidth,
                height: Math.floor(height * 0.7),
            },
            confidence: clampConfidence(0.9),
            source: "page_image",
            metadata,
        },
        {
            artifact_id: bubbleAId,
            artifact_type: "region",
            page_id: pageId,
            region_kind: "bubble",
            bbox: {
                x: 72 + deterministicOffset(pageId, 24),
                y: 96 + deterministicOffset(pageId, 18),
                width: Math.floor(leftPanelWidth * 0.42),
                height: 124,
            },
            confidence: clampConfidence(0.88),
            source: page.sourceTexts?.length ? page.sourceTexts[0]!.source : "ocr",
            metadata,
            classification: "speech",
            parent_artifact_id: panelAId,
        },
        {
            artifact_id: bubbleBId,
            artifact_type: "region",
            page_id: pageId,
            region_kind: "bubble",
            bbox: {
                x: leftPanelWidth + 112,
                y: Math.floor(height * 0.34),
                width: Math.floor(rightPanelWidth * 0.45),
                height: 132,
            },
            confidence: clampConfidence(0.84),
            source: page.sourceTexts?.[1]?.source ?? page.sourceTexts?.[0]?.source ?? "ocr",
            metadata,
            classification: "narration",
            parent_artifact_id: panelBId,
        },
        {
            artifact_id: textRegionId,
            artifact_type: "region",
            page_id: pageId,
            region_kind: "text_region",
            bbox: {
                x: leftPanelWidth + 96,
                y: Math.floor(height * 0.72),
                width: Math.floor(rightPanelWidth * 0.36),
                height: 96,
            },
            confidence: clampConfidence(0.63),
            source: "page_image",
            metadata,
            classification: "unknown",
            parent_artifact_id: panelBId,
        },
    ];

    const ocrArtifacts: OCRArtifact[] = [
        {
            artifact_id: `${pageId}-ocr-001`,
            artifact_type: "ocr",
            page_id: pageId,
            bbox: regions[2]!.bbox,
            confidence: clampConfidence(0.78),
            source: "ocr",
            metadata,
            text: page.sourceTexts?.[0]?.text ?? `OCR line for ${pageId}`,
            language: page.locale ?? "ja",
        },
        {
            artifact_id: `${pageId}-ocr-002`,
            artifact_type: "ocr",
            page_id: pageId,
            bbox: regions[3]!.bbox,
            confidence: clampConfidence(0.72),
            source: "ocr",
            metadata,
            text: page.sourceTexts?.[1]?.text ?? `Narration for ${pageId}`,
            language: page.locale ?? "ja",
        },
    ];

    return {
        regions: RegionArtifactsSchema.parse(regions),
        ocrArtifacts: OCRArtifactsSchema.parse(ocrArtifacts),
    };
}

function buildAlignmentArtifacts(input: AlignTextInput): AlignmentArtifact[] {
    const { page, regionArtifact } = input;
    const pageId = page.page.pageId;
    const metadata = fixtureMetadata(pageId, "align-text");
    const sourceTexts = page.sourceTexts ?? [];
    const bubbleRegions = regionArtifact.payload.candidates.filter(
        (candidate) => candidate.region_kind === "bubble",
    );

    const alignments = bubbleRegions.map((bubble, index) => {
        const selectedSource = sourceTexts[index]?.source ?? sourceTexts[0]?.source ?? "ocr";
        const sourceText = sourceTexts[index]?.text ?? sourceTexts[0]?.text;
        const ocrText =
            regionArtifact.payload.ocrCandidates?.[index]?.text ??
            `OCR fallback ${index + 1} for ${pageId}`;

        return {
            artifact_id: `${bubble.artifact_id}-align`,
            artifact_type: "alignment" as const,
            page_id: pageId,
            bbox: bubble.bbox,
            confidence: clampConfidence(0.81 - index * 0.06),
            source: selectedSource,
            metadata,
            bubble_candidate_id: bubble.artifact_id,
            panel_candidate_id: bubble.parent_artifact_id,
            selected_text: sourceText ?? ocrText,
            ocr_text: ocrText,
            source_text: sourceText,
            source_record_id: sourceTexts[index]?.id ?? sourceTexts[0]?.id,
            classification: bubble.classification ?? "speech",
        };
    });

    return AlignmentArtifactsSchema.parse(alignments);
}

function buildPageDraftCandidate(input: BuildDraftInput): PageDraft {
    const { page, regionArtifact, alignmentArtifact } = input;
    const panelRegions = regionArtifact.payload.candidates.filter(
        (candidate) => candidate.region_kind === "panel",
    );

    const panels = panelRegions.map((panelRegion, panelIndex) => {
        const bubbles = alignmentArtifact.payload.alignments
            .filter((alignment) => alignment.panel_candidate_id === panelRegion.artifact_id)
            .map((alignment, bubbleIndex) => ({
                bubbleNumber: bubbleIndex + 1,
                bubbleType: alignment.classification === "unknown" ? "speech" : alignment.classification,
                textOriginal: alignment.selected_text,
            }));

        return {
            panelNumber: panelIndex + 1,
            bbox: panelRegion.bbox,
            reactionTags: panelIndex === 0 ? ["poc:auto"] : [],
            bubbles,
        };
    });

    return PageDraftSchema.parse({
        pageNumber: page.page.pageNumber,
        imagePath: page.page.imagePath,
        width: page.page.width ?? 1600,
        height: page.page.height ?? 2400,
        panels,
    });
}

export class GeminiProvider implements IngestionLLMProvider {
    readonly providerId = GEMINI_PROVIDER_ID;

    async detectRegions(input: DetectRegionsInput): Promise<RegionDetectionArtifact> {
        // TODO: Replace deterministic fixtures with a Gemini vision call that returns
        // structured region candidates and OCR hints, then validate them against Zod.
        const { regions, ocrArtifacts } = buildRegionArtifacts(input);
        const pageId = input.page.page.pageId;

        return {
            layer: "artifact",
            stage: "detect_regions",
            pageId,
            metadata: fixtureMetadata(pageId, "detect-regions"),
            diagnostics: [],
            payload: {
                candidates: regions,
                ocrCandidates: ocrArtifacts,
            },
        };
    }

    async alignText(input: AlignTextInput): Promise<TextAlignmentArtifact> {
        // TODO: Replace deterministic fixtures with a Gemini reasoning/alignment call
        // that matches OCR output to source text exports before Zod validation.
        const alignments = buildAlignmentArtifacts(input);
        const pageId = input.page.page.pageId;

        return {
            layer: "artifact",
            stage: "align_text",
            pageId,
            metadata: fixtureMetadata(pageId, "align-text"),
            diagnostics: [],
            payload: {
                alignments,
            },
        };
    }

    async buildDraft(input: BuildDraftInput): Promise<DraftBuildArtifact> {
        // TODO: Replace deterministic fixtures with a Gemini structured-output call
        // that proposes a reviewable page draft candidate, then validate and wrap it.
        const pageDraft = buildPageDraftCandidate(input);
        const metadata = fixtureMetadata(input.page.page.pageId, "build-draft");

        return {
            layer: "artifact",
            stage: "build_draft",
            pageId: input.page.page.pageId,
            metadata,
            diagnostics: [],
            payload: {
                pageImagePath: pageDraft.imagePath,
                width: pageDraft.width,
                height: pageDraft.height,
                panels: pageDraft.panels.map((panel) => ({
                    panelCandidateId: panelCandidateId(input.page.page.pageId, panel.panelNumber),
                    panelConfidence: 0.82,
                    reactionTags: panel.reactionTags,
                    bubbles: panel.bubbles.map((bubble) => ({
                        bubbleCandidateId: bubbleCandidateId(
                            input.page.page.pageId,
                            panel.panelNumber,
                            bubble.bubbleNumber,
                        ),
                        bubbleConfidence: 0.79,
                        classification: bubble.bubbleType,
                        textOriginal: bubble.textOriginal,
                        speaker: bubble.speaker,
                    })),
                })),
            },
        };
    }
}
