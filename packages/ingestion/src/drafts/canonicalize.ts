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

export function buildCanonicalDraft(
    episode: EpisodeInput,
    artifacts: PageArtifactBundle[],
): CanonicalDraftEnvelope {
    const pages = episode.pages.map((pageInput) => {
        const artifact = artifacts.find((item) => item.pageId === pageInput.page.pageId)?.draftBuild;
        if (!artifact) {
            throw new Error(`Missing draft build artifact for page ${pageInput.page.pageId}`);
        }

        const dimensions = inferDimensions(
            artifact,
            pageInput.page.width,
            pageInput.page.height,
        );

        return {
            pageNumber: pageInput.page.pageNumber,
            imagePath: artifact.payload.pageImagePath,
            width: dimensions.width,
            height: dimensions.height,
            panels: artifact.payload.panels.map((panel, panelIndex) => ({
                panelNumber: panelIndex + 1,
                bbox: artifact.payload.panels[panelIndex]!.panelCandidateId
                    ? artifacts
                          .find((item) => item.pageId === pageInput.page.pageId)
                          ?.regionDetection?.payload.candidates.find(
                              (candidate) =>
                                  candidate.artifact_id === panel.panelCandidateId &&
                                  candidate.region_kind === "panel",
                          )?.bbox ?? { x: 0, y: 0, width: 0, height: 0 }
                    : { x: 0, y: 0, width: 0, height: 0 },
                reactionTags: panel.reactionTags,
                bubbles: panel.bubbles.map((bubble, bubbleIndex) => ({
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
