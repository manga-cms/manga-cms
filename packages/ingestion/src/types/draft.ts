import type {
    DraftBubble as DomainDraftBubble,
    DraftPage as DomainDraftPage,
    DraftPanel as DomainDraftPanel,
    DraftPayload,
} from "@manga/domain";

export type PageDraft = DomainDraftPage;
export type PanelDraft = DomainDraftPanel;
export type BubbleDraft = DomainDraftBubble;

export type CanonicalDraftPayload = DraftPayload;
export type CanonicalDraftPage = PageDraft;
export type CanonicalDraftPanel = PanelDraft;
export type CanonicalDraftBubble = BubbleDraft;

export interface ArtifactReference {
    pageId: string;
    stages: Array<"detect_regions" | "align_text" | "build_draft">;
}

export interface CanonicalDraftEnvelope {
    layer: "canonical_draft";
    draft: CanonicalDraftPayload;
    artifactReferences: ArtifactReference[];
    reviewNotes?: string[];
}
