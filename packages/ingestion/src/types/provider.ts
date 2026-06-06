import type {
    DraftBuildArtifact,
    RegionDetectionArtifact,
    TextAlignmentArtifact,
} from "./artifact.js";
import type { PageInput } from "./input.js";

export interface DetectRegionsInput {
    page: PageInput;
}

export interface AlignTextInput {
    page: PageInput;
    regionArtifact: RegionDetectionArtifact;
}

export interface BuildDraftInput {
    page: PageInput;
    regionArtifact: RegionDetectionArtifact;
    alignmentArtifact: TextAlignmentArtifact;
}

export interface IngestionLLMProvider {
    readonly providerId: string;
    detectRegions(input: DetectRegionsInput): Promise<RegionDetectionArtifact>;
    alignText(input: AlignTextInput): Promise<TextAlignmentArtifact>;
    buildDraft(input: BuildDraftInput): Promise<DraftBuildArtifact>;
}
