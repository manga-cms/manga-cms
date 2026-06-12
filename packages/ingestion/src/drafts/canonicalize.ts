import { estimateBubbleReadingOrder, estimatePanelReadingOrder } from "@manga/schemas";

import type {
    CanonicalDraftEnvelope,
    DraftBuildArtifact,
    EpisodeInput,
    PageArtifactBundle,
} from "../types/index.js";

function inferDimensions(
    artifact: DraftBuildArtifact,
    fallbackWidth?: number,
    fallbackHeight?: number,
): { width: number; height: number } {
    return {
        width: artifact.payload.width ?? fallbackWidth ?? 0,
        height: artifact.payload.height ?? fallbackHeight ?? 0,
    };
}

const emptyBbox = { x: 0, y: 0, width: 0, height: 0 };

function sortPanelsByReadingOrder(
    artifact: DraftBuildArtifact,
    pageBundle: PageArtifactBundle | undefined,
) {
    const panelBboxById = new Map(
        pageBundle?.regionDetection?.payload.candidates
            .filter((candidate) => candidate.region_kind === "panel")
            .map((candidate) => [candidate.artifact_id, candidate.bbox]) ?? [],
    );
    const panelById = new Map(
        artifact.payload.panels.map((panel) => [panel.panelCandidateId, panel]),
    );
    const estimatedPanelIds = estimatePanelReadingOrder(
        artifact.payload.panels.map((panel) => ({
            panelId: panel.panelCandidateId,
            bbox: panelBboxById.get(panel.panelCandidateId) ?? emptyBbox,
        })),
    );
    const orderedPanels = estimatedPanelIds
        .map((panelId) => panelById.get(panelId))
        .filter((panel): panel is DraftBuildArtifact["payload"]["panels"][number] => Boolean(panel));
    const orderedPanelIds = new Set(orderedPanels.map((panel) => panel.panelCandidateId));
    const remainingPanels = artifact.payload.panels.filter(
        (panel) => !orderedPanelIds.has(panel.panelCandidateId),
    );
    return {
        panels: [...orderedPanels, ...remainingPanels],
        panelBboxById,
    };
}

function sortBubblesByReadingOrder(
    panel: DraftBuildArtifact["payload"]["panels"][number],
    orderedPanels: DraftBuildArtifact["payload"]["panels"],
    panelBboxById: Map<string, { x: number; y: number; width: number; height: number }>,
    pageBundle: PageArtifactBundle | undefined,
    dimensions: { width: number; height: number },
) {
    const bubbleBboxById = new Map(
        pageBundle?.regionDetection?.payload.candidates
            .filter((candidate) => candidate.region_kind === "bubble")
            .map((candidate) => [candidate.artifact_id, candidate.bbox]) ?? [],
    );
    for (const alignment of pageBundle?.textAlignment?.payload.alignments ?? []) {
        if (!bubbleBboxById.has(alignment.bubble_candidate_id)) {
            bubbleBboxById.set(alignment.bubble_candidate_id, alignment.bbox);
        }
    }

    const allBubbles = orderedPanels.flatMap((candidatePanel) =>
        candidatePanel.bubbles.map((bubble) => ({
            bubbleId: bubble.bubbleCandidateId,
            panelId: candidatePanel.panelCandidateId,
            bbox: bubbleBboxById.get(bubble.bubbleCandidateId) ?? emptyBbox,
        })),
    );
    const bubbleRank = new Map(
        estimateBubbleReadingOrder({
            width: dimensions.width,
            height: dimensions.height,
            panels: orderedPanels.map((candidatePanel) => ({
                panelId: candidatePanel.panelCandidateId,
                bbox: panelBboxById.get(candidatePanel.panelCandidateId) ?? emptyBbox,
            })),
            bubbles: allBubbles,
        }).map((bubbleId, index) => [bubbleId, index]),
    );

    return [...panel.bubbles].sort((a, b) =>
        (bubbleRank.get(a.bubbleCandidateId) ?? Number.MAX_SAFE_INTEGER) -
        (bubbleRank.get(b.bubbleCandidateId) ?? Number.MAX_SAFE_INTEGER) ||
        a.bubbleCandidateId.localeCompare(b.bubbleCandidateId),
    );
}

export function buildCanonicalDraft(
    episode: EpisodeInput,
    artifacts: PageArtifactBundle[],
): CanonicalDraftEnvelope {
    const pages = episode.pages.map((pageInput) => {
        const pageBundle = artifacts.find((item) => item.pageId === pageInput.page.pageId);
        const artifact = pageBundle?.draftBuild;
        if (!artifact) {
            throw new Error(`Missing draft build artifact for page ${pageInput.page.pageId}`);
        }

        const dimensions = inferDimensions(
            artifact,
            pageInput.page.width,
            pageInput.page.height,
        );

        const { panels: orderedPanels, panelBboxById } = sortPanelsByReadingOrder(artifact, pageBundle);

        return {
            pageNumber: pageInput.page.pageNumber,
            imagePath: artifact.payload.pageImagePath,
            width: dimensions.width,
            height: dimensions.height,
            panels: orderedPanels.map((panel, panelIndex) => ({
                panelNumber: panelIndex + 1,
                bbox: panelBboxById.get(panel.panelCandidateId) ?? emptyBbox,
                reactionTags: panel.reactionTags,
                bubbles: sortBubblesByReadingOrder(
                    panel,
                    orderedPanels,
                    panelBboxById,
                    pageBundle,
                    dimensions,
                ).map((bubble, bubbleIndex) => ({
                    bubbleNumber: bubbleIndex + 1,
                    bubbleType: bubble.classification === "unknown" ? "speech" : bubble.classification,
                    textOriginal: bubble.textOriginal,
                    speaker: bubble.speaker,
                })),
            })),
        };
    });

    return {
        layer: "canonical_draft",
        draft: {
            seriesId: episode.seriesId,
            seriesTitle: episode.seriesTitle,
            seriesDescription: episode.seriesDescription,
            seriesStatus: episode.seriesStatus,
            episodeId: episode.episodeId,
            episodeNumber: episode.episodeNumber,
            episodeTitle: episode.episodeTitle,
            pages,
        },
        artifactReferences: artifacts.map((artifact) => ({
            pageId: artifact.pageId,
            stages: [
                artifact.regionDetection ? "detect_regions" : null,
                artifact.textAlignment ? "align_text" : null,
                artifact.draftBuild ? "build_draft" : null,
            ].filter((stage): stage is "detect_regions" | "align_text" | "build_draft" => Boolean(stage)),
        })),
    };
}
