import type {
    DraftBuildArtifact,
    PageArtifactBundle,
    RegionDetectionArtifact,
    TextAlignmentArtifact,
} from "../types/index.js";

export function createArtifactBundle(pageId: string): PageArtifactBundle {
    return {
        layer: "artifact",
        pageId,
    };
}

export function withRegionDetection(
    bundle: PageArtifactBundle,
    artifact: RegionDetectionArtifact,
): PageArtifactBundle {
    return {
        ...bundle,
        regionDetection: artifact,
    };
}

export function withTextAlignment(
    bundle: PageArtifactBundle,
    artifact: TextAlignmentArtifact,
): PageArtifactBundle {
    return {
        ...bundle,
        textAlignment: artifact,
    };
}

export function withDraftBuild(
    bundle: PageArtifactBundle,
    artifact: DraftBuildArtifact,
): PageArtifactBundle {
    return {
        ...bundle,
        draftBuild: artifact,
    };
}
