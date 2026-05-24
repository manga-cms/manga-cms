import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
    buildCanonicalDraft,
    CanonicalDraftPayloadSchema,
    GeminiProvider,
    OCRArtifactSchema,
    type AlignmentArtifact,
    type DraftBuildArtifact,
    type EpisodeInput,
    type OCRArtifact,
    type PageArtifactBundle,
    type PageInput,
    type RegionArtifact,
    type RegionDetectionArtifact,
    type TextAlignmentArtifact,
} from "../packages/ingestion/dist/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const CONTENTS_DIR = join(ROOT_DIR, "contents");
const ARTIFACT_ROOT = "/tmp/ingestion-artifacts";
const DRAFT_ROOT = "/tmp/ingestion-drafts";

const LOW_CONFIDENCE_THRESHOLD = 0.8;
const MANUAL_BASELINE_SECONDS_PER_PAGE = 180;
const BASE_REVIEW_SECONDS_PER_PAGE = 35;
const UNMATCHED_BUBBLE_PENALTY_SECONDS = 25;
const LOW_CONFIDENCE_REGION_PENALTY_SECONDS = 15;

interface SourceBubble {
    textOriginal: string;
    speaker?: string;
}

interface SourcePanel {
    bubbles: SourceBubble[];
}

interface SourcePage {
    id: string;
    pageNumber: number;
    width: number;
    height: number;
    images: Record<string, string>;
    panels: SourcePanel[];
}

interface SourceEpisode {
    id: string;
    episodeNumber: number;
    title: string;
    pages: SourcePage[];
}

interface SourceSeries {
    id: string;
    title: string;
    description?: string;
    status?: "ongoing" | "completed" | "hiatus";
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}

function ensureCleanDir(path: string): void {
    rmSync(path, { recursive: true, force: true });
    mkdirSync(path, { recursive: true });
}

function writeJson(path: string, data: unknown): void {
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function buildEpisodeInput(seriesId: string, episodeId: string): EpisodeInput {
    const series = readJson<SourceSeries>(join(CONTENTS_DIR, seriesId, "series.json"));
    const episode = readJson<SourceEpisode>(
        join(CONTENTS_DIR, seriesId, episodeId, "episode.json"),
    );

    const pages: PageInput[] = episode.pages.map((page) => ({
        jobId: `poc-${seriesId}-${episodeId}`,
        seriesId,
        episodeId,
        episodeNumber: episode.episodeNumber,
        episodeTitle: episode.title,
        page: {
            pageNumber: page.pageNumber,
            pageId: page.id,
            imagePath: page.images.ja ?? Object.values(page.images)[0] ?? `pages/p${page.pageNumber}.jpg`,
            width: page.width,
            height: page.height,
        },
        sourceTexts: page.panels.flatMap((panel, panelIndex) =>
            panel.bubbles.map((bubble, bubbleIndex) => ({
                id: `${page.id}-source-${panelIndex + 1}-${bubbleIndex + 1}`,
                source: "clip_text_export" as const,
                text: bubble.textOriginal,
                order: panelIndex * 100 + bubbleIndex,
                layerName: bubble.speaker,
            })),
        ),
        locale: "ja",
    }));

    return {
        jobId: `poc-${seriesId}-${episodeId}`,
        seriesId: series.id,
        seriesTitle: series.title,
        seriesDescription: series.description,
        seriesStatus: series.status,
        episodeId: episode.id,
        episodeNumber: episode.episodeNumber,
        episodeTitle: episode.title,
        pages,
    };
}

function extractPanels(artifact: RegionDetectionArtifact): RegionArtifact[] {
    return artifact.payload.candidates.filter((candidate) => candidate.region_kind === "panel");
}

function extractBubbles(artifact: RegionDetectionArtifact): RegionArtifact[] {
    return artifact.payload.candidates.filter((candidate) => candidate.region_kind === "bubble");
}

function averageConfidence(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function estimateReviewTimeSecondsPerPage(
    unmatchedBubbles: number,
    lowConfidenceRegions: number,
): number {
    return (
        BASE_REVIEW_SECONDS_PER_PAGE +
        unmatchedBubbles * UNMATCHED_BUBBLE_PENALTY_SECONDS +
        lowConfidenceRegions * LOW_CONFIDENCE_REGION_PENALTY_SECONDS
    );
}

function printSection(title: string): void {
    console.log(`\n=== ${title} ===`);
}

async function main(): Promise<void> {
    const episodeInput = buildEpisodeInput("rain-world", "ep01");
    const provider = new GeminiProvider();
    const jobId = episodeInput.jobId;
    const artifactDir = join(ARTIFACT_ROOT, jobId);
    const draftDir = join(DRAFT_ROOT, jobId);

    ensureCleanDir(artifactDir);
    ensureCleanDir(draftDir);

    const bundles: PageArtifactBundle[] = [];
    const reviewEstimates: number[] = [];
    let totalPanelsDetected = 0;
    let totalBubblesDetected = 0;
    let totalUnmatchedTextCount = 0;
    const regionConfidences: number[] = [];
    const alignmentConfidences: number[] = [];
    const ocrConfidences: number[] = [];

    printSection("Ingestion PoC");
    console.log(`job_id: ${jobId}`);
    console.log(`pages: ${episodeInput.pages.length}`);
    console.log(`artifact_output: ${artifactDir}`);
    console.log(`draft_output: ${draftDir}`);

    for (const page of episodeInput.pages) {
        const pageDir = join(artifactDir, page.page.pageId);
        mkdirSync(pageDir, { recursive: true });

        printSection(`Page ${page.page.pageNumber} (${page.page.pageId})`);

        const normalizedInput = {
            page_id: page.page.pageId,
            image_path: page.page.imagePath,
            width: page.page.width,
            height: page.page.height,
            source_text_count: page.sourceTexts?.length ?? 0,
        };
        console.log("1. normalize");
        writeJson(join(pageDir, "01-normalize.json"), normalizedInput);

        console.log("2. detectRegions");
        const regionArtifact = await provider.detectRegions({ page });
        writeJson(join(pageDir, "02-detect-regions.json"), regionArtifact);

        console.log("3. OCR stage (mock)");
        const ocrArtifacts: OCRArtifact[] = OCRArtifactSchema.array().parse(
            regionArtifact.payload.ocrCandidates ?? [],
        );
        writeJson(join(pageDir, "03-ocr.json"), ocrArtifacts);

        console.log("4. alignText");
        const alignmentArtifact = await provider.alignText({
            page,
            regionArtifact,
        });
        writeJson(join(pageDir, "04-align-text.json"), alignmentArtifact);

        console.log("5. buildDraft");
        const draftArtifact = await provider.buildDraft({
            page,
            regionArtifact,
            alignmentArtifact,
        });
        writeJson(join(pageDir, "05-build-draft.json"), draftArtifact);

        bundles.push({
            layer: "artifact",
            pageId: page.page.pageId,
            regionDetection: regionArtifact,
            textAlignment: alignmentArtifact,
            draftBuild: draftArtifact,
        });

        const panelArtifacts = extractPanels(regionArtifact);
        const bubbleArtifacts = extractBubbles(regionArtifact);
        const matchedBubbleIds = new Set(
            alignmentArtifact.payload.alignments.map((alignment) => alignment.bubble_candidate_id),
        );

        const unmatchedBubbleCount = bubbleArtifacts.filter(
            (bubble) =>
                !matchedBubbleIds.has(bubble.artifact_id) ||
                bubble.source === "ocr" ||
                !alignmentArtifact.payload.alignments.find(
                    (alignment) =>
                        alignment.bubble_candidate_id === bubble.artifact_id &&
                        alignment.source_text,
                ),
        ).length;

        const lowConfidenceRegionCount = regionArtifact.payload.candidates.filter(
            (candidate) => candidate.confidence < LOW_CONFIDENCE_THRESHOLD,
        ).length;

        totalPanelsDetected += panelArtifacts.length;
        totalBubblesDetected += bubbleArtifacts.length;
        totalUnmatchedTextCount += unmatchedBubbleCount;

        regionConfidences.push(...regionArtifact.payload.candidates.map((candidate) => candidate.confidence));
        alignmentConfidences.push(
            ...alignmentArtifact.payload.alignments.map((alignment) => alignment.confidence),
        );
        ocrConfidences.push(...ocrArtifacts.map((artifact) => artifact.confidence));

        const reviewSeconds = estimateReviewTimeSecondsPerPage(
            unmatchedBubbleCount,
            lowConfidenceRegionCount,
        );
        reviewEstimates.push(reviewSeconds);

        console.log(`panels_detected: ${panelArtifacts.length}`);
        console.log(`bubbles_detected: ${bubbleArtifacts.length}`);
        console.log(`unmatched_text_count: ${unmatchedBubbleCount}`);
        console.log(`low_confidence_regions: ${lowConfidenceRegionCount}`);
        console.log(`estimate_review_time_seconds_per_page: ${reviewSeconds}`);
    }

    const canonicalDraft = buildCanonicalDraft(episodeInput, bundles);
    const validatedDraft = CanonicalDraftPayloadSchema.parse(canonicalDraft.draft);
    writeJson(join(draftDir, "canonical-draft.json"), validatedDraft);
    writeJson(join(draftDir, "artifact-references.json"), canonicalDraft.artifactReferences);

    const pagesProcessed = episodeInput.pages.length;
    const averageRegionConfidence = averageConfidence(regionConfidences);
    const averageAlignmentConfidence = averageConfidence(alignmentConfidences);
    const averageOcrConfidence = averageConfidence(ocrConfidences);
    const averageReviewSeconds = averageConfidence(reviewEstimates);
    const annotationReduction =
        ((MANUAL_BASELINE_SECONDS_PER_PAGE - averageReviewSeconds) /
            MANUAL_BASELINE_SECONDS_PER_PAGE) *
        100;

    printSection("Summary");
    console.log(`pages_processed: ${pagesProcessed}`);
    console.log(`panels_detected: ${totalPanelsDetected}`);
    console.log(`bubbles_detected: ${totalBubblesDetected}`);
    console.log(`average_region_confidence: ${averageRegionConfidence.toFixed(3)}`);
    console.log(`average_alignment_confidence: ${averageAlignmentConfidence.toFixed(3)}`);
    console.log(`average_ocr_confidence: ${averageOcrConfidence.toFixed(3)}`);
    console.log(`UNMATCHED_TEXT_COUNT: ${totalUnmatchedTextCount}`);
    console.log(
        `estimate_review_time_seconds_per_page: ${averageReviewSeconds.toFixed(1)}`,
    );
    console.log(
        `Estimated manual review time per page: ${averageReviewSeconds.toFixed(1)}s`,
    );
    console.log(
        `Estimated annotation reduction vs manual baseline (${MANUAL_BASELINE_SECONDS_PER_PAGE}s): ${annotationReduction.toFixed(1)}%`,
    );
}

await main();
