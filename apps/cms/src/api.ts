const API = "/api/v1";

type ApiErrorPayload = {
    error?: {
        code?: string;
        message?: string;
    };
};

export class CmsApiError extends Error {
    status: number;
    code?: string;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.name = "CmsApiError";
        this.status = status;
        this.code = code;
    }
}

export function isPermissionError(error: unknown) {
    return error instanceof CmsApiError && error.status === 403;
}

async function readApiError(res: Response): Promise<ApiErrorPayload> {
    try {
        return await res.json() as ApiErrorPayload;
    } catch {
        return {};
    }
}

function errorMessage(data: ApiErrorPayload, fallback: string) {
    return data.error?.message ?? fallback;
}

function throwSeriesListError(res: Response, data: ApiErrorPayload): never {
    if (res.status === 403) {
        throw new CmsApiError(res.status, "管理できる作品がありません。", data.error?.code);
    }
    throw new CmsApiError(res.status, errorMessage(data, "Admin login or Series permission required"), data.error?.code);
}

function throwSeriesEditError(res: Response, data: ApiErrorPayload, fallback: string): never {
    if (res.status === 403) {
        throw new CmsApiError(res.status, "この作品を編集する権限がありません。", data.error?.code);
    }
    throw new CmsApiError(res.status, errorMessage(data, fallback), data.error?.code);
}

export type SeriesPublicationType = "serial" | "oneshot";
export type SeriesLifecycleStatus = "ongoing" | "completed" | "hiatus";

export interface LocalizedContentMetadata {
    title?: string;
    description?: string;
    shareTitle?: string;
    shareDescription?: string;
    authorLabel?: string;
}

export interface ContentPublicMetadata {
    authorLabel?: string;
    localized?: Record<string, LocalizedContentMetadata>;
}

export interface SeriesItem {
    id: string;
    title: string;
    description: string;
    publicationType?: SeriesPublicationType;
    lifecycleStatus?: SeriesLifecycleStatus;
    status: SeriesLifecycleStatus;
    coverUrl: string;
    shareImageUrl?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    metadata?: ContentPublicMetadata;
    episodeCount: number;
}

export type PublicationVisibility = "public" | "hidden" | "archived";

export interface EpisodeSummary {
    id: string;
    episodeNumber: number;
    title: string;
    publishedAt: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    pageCount: number;
}

export interface SeriesDetail {
    id: string;
    title: string;
    description: string;
    publicationType?: SeriesPublicationType;
    lifecycleStatus?: SeriesLifecycleStatus;
    status: SeriesLifecycleStatus;
    coverUrl: string;
    shareImageUrl?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    metadata?: ContentPublicMetadata;
    episodes: EpisodeSummary[];
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    imageId?: string;
    coordinateSpace?: "pixel";
}

export interface BubbleTextLayout {
    lines?: string[];
    inlineAlign?: "start" | "center" | "end";
    blockAlign?: "start" | "center" | "end";
    offsetXPercent?: number;
    offsetYPercent?: number;
    source?: "manual" | "imported" | "ocr";
}

export interface BubbleTextStyle {
    fontSizePx?: number;
    fontWeight?: number;
    lineHeight?: number;
    letterSpacing?: number;
    fitMode?: "auto" | "shrink" | "fixed";
}

export interface BubbleData {
    bubbleId?: string;
    id: string;
    panelId?: string | null;
    stableRef?: string;
    displayRef?: string;
    status?: "active" | "deprecated" | "deleted" | "merged";
    bubbleNumber: number;
    shortId?: string;
    bubbleType: "speech" | "thought" | "narration" | "sfx" | "caption" | "other";
    textOriginal: string;
    speaker?: string;
    speakerConfidence?: "confirmed" | "inferred" | "unknown";
    textDirection?: "horizontal" | "vertical";
    lang?: string;
    flags?: ContentFlags;
    metadata?: ContentPublicMetadata;
    textLayout?: BubbleTextLayout;
    textStyle?: BubbleTextStyle;
    bbox: BoundingBox;
}

export interface ContentFlags {
    shareable: boolean;
    feedback_enabled: boolean;
    contains_spoiler?: boolean;
}

export interface PanelData {
    panelId?: string;
    id: string;
    stableRef?: string;
    displayRef?: string;
    status?: "active" | "deprecated" | "deleted" | "merged";
    panelNumber: number;
    bbox: BoundingBox;
    reactionTags: string[];
    flags?: ContentFlags;
    bubbles: BubbleData[];
}

export interface PageData {
    schemaVersion?: 2;
    pageId?: string;
    id: string;
    stableRef?: string;
    pageNumber: number;
    displayRef?: string;
    images: Record<string, string>;
    imageId?: string;
    imageHash?: string;
    coordinateSpace?: "pixel";
    width: number;
    height: number;
    status?: "active" | "deprecated" | "deleted" | "merged";
    flags?: ContentFlags;
    panels: PanelData[];
    bubbles: BubbleData[];
}

export interface EpisodeData {
    schemaVersion?: 2;
    editionId?: string;
    revisionId?: string;
    id: string;
    episodeNumber: number;
    title: string;
    publishedAt: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    pages: PageData[];
}

function panelIdOf(panel: Pick<PanelData, "panelId" | "id">) {
    return panel.panelId ?? panel.id;
}

function bubbleIdOf(bubble: Pick<BubbleData, "bubbleId" | "id">) {
    return bubble.bubbleId ?? bubble.id;
}

function normalizeBubble(input: any, fallbackPanelId: string | null, fallbackNumber: number): BubbleData {
    const bubbleId = input.bubbleId ?? input.id ?? `bubble-${fallbackNumber}`;
    const displayRef = input.displayRef ?? input.shortId;
    return {
        ...input,
        bubbleId,
        id: input.id ?? bubbleId,
        panelId: input.panelId === undefined ? fallbackPanelId : input.panelId,
        stableRef: input.stableRef ?? bubbleId,
        ...(displayRef !== undefined && { displayRef, shortId: input.shortId ?? displayRef }),
        bubbleNumber: input.bubbleNumber ?? fallbackNumber,
    };
}

function normalizePanel(input: any): PanelData {
    const panelId = input.panelId ?? input.id;
    return {
        ...input,
        panelId,
        id: input.id ?? panelId,
        stableRef: input.stableRef ?? panelId,
        reactionTags: input.reactionTags ?? [],
        bubbles: [],
    };
}

function normalizePage(input: any): PageData {
    const pageId = input.pageId ?? input.id;
    const panels = (input.panels ?? []).map(normalizePanel);
    const legacyNestedBubbles = (input.panels ?? []).flatMap((panel: any) => {
        const panelId = panel.panelId ?? panel.id ?? null;
        return (panel.bubbles ?? []).map((bubble: any, index: number) => normalizeBubble(bubble, panelId, index + 1));
    });
    const sourceBubbles = Array.isArray(input.bubbles) && input.bubbles.length > 0
        ? input.bubbles.map((bubble: any, index: number) => normalizeBubble(bubble, bubble.panelId ?? null, index + 1))
        : legacyNestedBubbles;
    const bubblesById = new Map<string, BubbleData>();
    sourceBubbles.forEach((bubble: BubbleData) => {
        bubblesById.set(bubbleIdOf(bubble), bubble);
    });
    const bubbles = [...bubblesById.values()];
    return {
        ...input,
        schemaVersion: input.schemaVersion ?? 2,
        pageId,
        id: input.id ?? pageId,
        stableRef: input.stableRef ?? pageId,
        coordinateSpace: input.coordinateSpace ?? "pixel",
        bubbles,
        panels: panels.map((panel: PanelData) => ({
            ...panel,
            bubbles: bubbles.filter((bubble) => bubble.panelId === panelIdOf(panel)),
        })),
    };
}

function normalizeEpisode(input: any): EpisodeData {
    return {
        ...input,
        schemaVersion: input.schemaVersion ?? 2,
        pages: (input.pages ?? []).map(normalizePage),
    };
}

function serializePageForSave(input: any): any {
    const pageId = input.pageId ?? input.id;
    const rawPanels = input.panels ?? [];
    const panelsWithBubbles = rawPanels.map(normalizePanel).map((panel: PanelData, index: number) => ({
        ...panel,
        bubbles: (rawPanels[index]?.bubbles ?? []).map((bubble: any, bubbleIndex: number) =>
            normalizeBubble(bubble, panelIdOf(panel), bubbleIndex + 1),
        ),
    }));
    const assignedBubblesFromPanels = panelsWithBubbles.flatMap((panel: PanelData) =>
        panel.bubbles.map((bubble) => normalizeBubble(bubble, panelIdOf(panel), bubble.bubbleNumber)),
    );
    const assignedBubblesFromPage = (input.bubbles ?? [])
        .filter((bubble: any) => bubble.panelId !== null)
        .map((bubble: any, index: number) => normalizeBubble(bubble, bubble.panelId, index + 1));
    const hasNestedBubbleArrays = rawPanels.length === 0 || rawPanels.some((panel: any) => Array.isArray(panel.bubbles));
    const assignedBubbles = hasNestedBubbleArrays ? assignedBubblesFromPanels : assignedBubblesFromPage;
    const pageLevelBubbles = (input.bubbles ?? [])
        .filter((bubble: any) => bubble.panelId === null)
        .map((bubble: any, index: number) => normalizeBubble(bubble, null, index + 1));
    const bubbles = [...assignedBubbles, ...pageLevelBubbles].map((bubble, index) => ({
        ...bubble,
        bubbleNumber: index + 1,
    }));
    const panels = panelsWithBubbles.map((panel) => {
        const { bubbles: _bubbles, ...panelData } = panel;
        return panelData;
    });
    return {
        ...input,
        schemaVersion: 2,
        pageId,
        id: input.id ?? pageId,
        stableRef: input.stableRef ?? pageId,
        coordinateSpace: input.coordinateSpace ?? "pixel",
        panels,
        bubbles,
    };
}

export async function listSeries(): Promise<SeriesItem[]> {
    const res = await fetch(`${API}/admin/series`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throwSeriesListError(res, data);
    return data.items ?? [];
}

export async function getSeries(id: string): Promise<SeriesDetail | null> {
    const res = await fetch(`${API}/admin/series/${id}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) {
        if (res.status === 404) return null;
        throwSeriesEditError(res, data, "Admin login or Series permission required");
    }
    return data;
}

export async function createSeries(input: {
    id: string;
    title: string;
    description?: string;
    publicationType?: SeriesPublicationType;
    lifecycleStatus?: SeriesLifecycleStatus;
    status?: SeriesLifecycleStatus;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    metadata?: ContentPublicMetadata;
}) {
    const res = await fetch(`${API}/admin/series`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to create series");
    return data;
}

export async function updateSeries(id: string, input: {
    title?: string;
    description?: string;
    publicationType?: SeriesPublicationType;
    lifecycleStatus?: SeriesLifecycleStatus;
    status?: SeriesLifecycleStatus;
    cover?: string;
    shareImageUrl?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    metadata?: ContentPublicMetadata;
}) {
    const res = await fetch(`${API}/admin/series/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throwSeriesEditError(res, data, "Failed to update series");
    return data;
}

export async function saveEpisode(seriesId: string, input: {
    id: string;
    episodeNumber: number;
    title: string;
    publishedAt?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    pages: unknown[];
}) {
    const payload = {
        ...input,
        schemaVersion: 2,
        pages: input.pages.map(serializePageForSave),
    };
    const res = await fetch(`${API}/admin/series/${seriesId}/episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throwSeriesEditError(res, data, "Failed to save episode");
    return data;
}

export async function getAdminEpisode(seriesId: string, episodeId: string): Promise<EpisodeData | null> {
    const res = await fetch(`${API}/admin/series/${seriesId}/episodes/${episodeId}`, {
        credentials: "include",
    });
    if (!res.ok) {
        if (res.status === 404) return null;
        throwSeriesEditError(res, await readApiError(res), "Admin login or Series permission required");
    }
    return normalizeEpisode(await res.json());
}

export async function patchBubbleLettering(
    seriesId: string,
    episodeId: string,
    pageId: string,
    bubbleId: string,
    input: {
        textLayout?: BubbleTextLayout;
        textStyle?: BubbleTextStyle;
    },
): Promise<EpisodeData> {
    const res = await fetch(`${API}/admin/series/${seriesId}/episodes/${episodeId}/pages/${pageId}/bubbles/${bubbleId}/lettering`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throwSeriesEditError(res, data, "Failed to update lettering");
    return normalizeEpisode(data.episode);
}

export function getAdminPageImageUrl(seriesId: string, episodeId: string, pageNumber: number, locale = "ja") {
    const params = new URLSearchParams({ locale });
    return `${API}/admin/series/${seriesId}/episodes/${episodeId}/pages/${pageNumber}/image?${params.toString()}`;
}

export async function uploadAdminPageImage(
    seriesId: string,
    episodeId: string,
    pageNumber: number,
    file: File,
    locale = "ja",
) {
    const params = new URLSearchParams({ locale });
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/admin/series/${seriesId}/episodes/${episodeId}/pages/${pageNumber}/image?${params.toString()}`, {
        method: "POST",
        credentials: "include",
        body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Image upload failed");
    return data as {
        uploaded: true;
        imagePath: string;
        contentType: string;
        size: number;
        sha256: string;
    };
}

export async function publishSeries(seriesId: string) {
    const res = await fetch(`${API}/admin/series/${seriesId}/publish`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Publish failed");
    return data;
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

export interface IngestionJob {
    id: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    label: string;
    draft: DraftPayload | null;
    errorMessage?: string;
}

export interface DraftPayload {
    seriesId: string;
    seriesTitle: string;
    seriesDescription?: string;
    seriesStatus?: string;
    episodeId: string;
    episodeNumber: number;
    episodeTitle: string;
    pages: DraftPage[];
}

export interface DraftPage {
    pageNumber: number;
    imagePath: string;
    sourceImagePath?: string;
    width: number;
    height: number;
    displayRef?: string;
    panels: DraftPanel[];
}

export interface DraftPanel {
    panelNumber: number;
    bbox: { x: number; y: number; width: number; height: number };
    reactionTags: string[];
    bubbles: DraftBubble[];
}

export interface DraftBubble {
    bubbleId?: string;
    id?: string;
    bubbleNumber: number;
    bubbleType: string;
    textOriginal: string;
    speaker?: string;
    bbox?: BoundingBox;
    shortId?: string;
    speakerConfidence?: "confirmed" | "inferred" | "unknown";
    textDirection?: "horizontal" | "vertical";
    lang?: string;
    flags?: ContentFlags;
    sourceText?: string;
    source_text?: string;
    ocrText?: string;
    ocr_text?: string;
    chosenText?: string;
    chosen_text?: string;
    confidence?: number;
    ocrConfidence?: number;
    ocr_confidence?: number;
    detectionMetadata?: {
        ocrConfidence?: number;
        detectionConfidence?: number;
    };
}

export type IngestionReviewDecisionValue = "pending" | "accepted" | "rejected";

export interface IngestionReviewTarget {
    kind: "panel" | "bubble";
    pageNumber: number;
    panelNumber: number;
    bubbleNumber?: number;
}

export interface IngestionReviewCandidate {
    key: string;
    target: IngestionReviewTarget;
    decision: IngestionReviewDecisionValue;
    panel?: DraftPanel;
    bubble?: DraftBubble;
}

export async function listJobs(): Promise<IngestionJob[]> {
    const res = await fetch(`${API}/admin/ingestion/jobs`, { credentials: "include" });
    const data = await res.json();
    return data.items ?? [];
}

export async function getJob(jobId: string): Promise<IngestionJob | null> {
    const res = await fetch(`${API}/admin/ingestion/jobs/${jobId}`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
}

export async function getReviewCandidates(jobId: string): Promise<IngestionReviewCandidate[]> {
    const res = await fetch(`${API}/admin/ingestion/jobs/${jobId}/review-candidates`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to load review candidates");
    return data.items ?? [];
}

export async function setReviewDecision(
    jobId: string,
    target: IngestionReviewTarget,
    decision: IngestionReviewDecisionValue,
) {
    const res = await fetch(`${API}/admin/ingestion/jobs/${jobId}/review-decisions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target, decision }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to save review decision");
    return data.items as IngestionReviewCandidate[];
}

export async function writeReviewedDraft(jobId: string) {
    const res = await fetch(`${API}/admin/ingestion/jobs/${jobId}/write-reviewed-draft`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to write reviewed draft");
    return data.draft as DraftPayload;
}

export async function createJob(label: string, draft?: DraftPayload) {
    const res = await fetch(`${API}/admin/ingestion/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label, draft }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to create job");
    return data as IngestionJob;
}

export interface PreparedDirectoryImportInput {
    label?: string;
    sourceDir: string;
    seriesId: string;
    seriesTitle: string;
    seriesDescription?: string;
    seriesStatus?: string;
    episodeId: string;
    episodeNumber: number;
    episodeTitle: string;
    defaultWidth?: number;
    defaultHeight?: number;
    pages?: PreparedDirectoryImportPageInput[];
}

export interface PreparedDirectoryImportPageInput {
    sourcePath?: string;
    fileName?: string;
    pageNumber?: number;
    width?: number;
    height?: number;
    displayRef?: string;
}

export async function importPreparedDirectory(input: PreparedDirectoryImportInput) {
    const res = await fetch(`${API}/admin/ingestion/import/prepared-directory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Prepared directory import failed");
    return data as IngestionJob;
}

// ---------------------------------------------------------------------------
// Feedback triage
// ---------------------------------------------------------------------------

export type FeedbackStatus = "new" | "triaged" | "closed";

export interface FeedbackRecord {
    feedback_id: string;
    status: FeedbackStatus;
    created_at: string;
    series_id: string;
    episode_id: string;
    page_id?: string | null;
    panel_id?: string | null;
    bubble_id?: string | null;
    mode: "read" | "explore" | "completion";
    issue_type: "typo" | "mistranslation" | "better_translation" | "missing_note" | "display" | "broken_link" | "spoiler" | "other";
    comment?: string;
    lang?: string;
    current_text?: string;
    current_translation?: string;
    suggested_text?: string;
    user_id?: string | null;
    contributor_identity?: ContributorIdentity;
    source_url: string;
    user_agent?: string;
    client_time?: string;
    client_ip?: string | null;
    triage_note?: string;
    triaged_by?: string;
    triaged_at?: string;
}

export async function listFeedback(filters: { status?: FeedbackStatus; seriesId?: string } = {}): Promise<FeedbackRecord[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.seriesId) params.set("seriesId", filters.seriesId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API}/admin/feedback${suffix}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to load feedback");
    return data.items ?? [];
}

export async function getFeedback(feedbackId: string): Promise<FeedbackRecord | null> {
    const res = await fetch(`${API}/admin/feedback/${feedbackId}`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
}

export async function updateFeedbackStatus(feedbackId: string, status: FeedbackStatus, triageNote?: string) {
    const res = await fetch(`${API}/admin/feedback/${feedbackId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, triage_note: triageNote }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to update feedback");
    return data as FeedbackRecord;
}

// ---------------------------------------------------------------------------
// Proposal queue
// ---------------------------------------------------------------------------

export type ProposalKind = "translation" | "typo" | "footnote" | "commentary" | "tag" | "structure";
export type ProposalStatus = "new" | "triaged" | "accepted" | "rejected" | "closed";

export interface ProposalRecord {
    proposal_id: string;
    kind: ProposalKind;
    status: ProposalStatus;
    created_at: string;
    updated_at: string;
    source_feedback_id?: string | null;
    series_id: string;
    episode_id: string;
    page_id?: string | null;
    panel_id?: string | null;
    bubble_id?: string | null;
    lang?: string;
    current_text?: string;
    current_translation?: string;
    suggested_text?: string;
    comment?: string;
    proposer_id?: string | null;
    contributor_identity?: ContributorIdentity;
    source_url?: string;
    review_note?: string;
    reviewed_by?: string;
    reviewed_at?: string;
}

export interface ProposalCreateInput {
    kind: ProposalKind;
    status?: ProposalStatus;
    source_feedback_id?: string | null;
    series_id: string;
    episode_id: string;
    page_id?: string | null;
    panel_id?: string | null;
    bubble_id?: string | null;
    lang?: string;
    current_text?: string;
    current_translation?: string;
    suggested_text?: string;
    comment?: string;
    proposer_id?: string | null;
    contributor_identity?: ContributorIdentity;
    source_url?: string;
}

export type ContributorIdentity =
    | { identity_level: "anonymous" }
    | { identity_level: "display_name"; display_name: string }
    | { identity_level: "github_login"; github_login: string; github_user_id?: string; verified: true };

export async function createProposal(input: ProposalCreateInput) {
    const res = await fetch(`${API}/admin/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to create proposal");
    return data as ProposalRecord;
}

export async function listProposals(filters: { status?: ProposalStatus; kind?: ProposalKind; seriesId?: string } = {}): Promise<ProposalRecord[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.kind) params.set("kind", filters.kind);
    if (filters.seriesId) params.set("seriesId", filters.seriesId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API}/admin/proposals${suffix}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to load proposals");
    return data.items ?? [];
}

export async function getProposal(proposalId: string): Promise<ProposalRecord | null> {
    const res = await fetch(`${API}/admin/proposals/${proposalId}`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
}

export async function updateProposalStatus(proposalId: string, status: ProposalStatus, reviewNote?: string) {
    const res = await fetch(`${API}/admin/proposals/${proposalId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, review_note: reviewNote }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to update proposal");
    return data as ProposalRecord;
}

export async function createProposalFromFeedback(feedbackId: string) {
    const res = await fetch(`${API}/admin/feedback/${feedbackId}/proposal`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to create proposal");
    return data as ProposalRecord;
}

// ---------------------------------------------------------------------------
// GitHub handoff queue
// ---------------------------------------------------------------------------

export type GitHubHandoffTargetType = "feedback" | "proposal";
export type GitHubHandoffMode = "triage_issue_comment" | "direct_issue" | "direct_pr";
export type GitHubHandoffStatus = "queued" | "ready" | "sent" | "failed" | "canceled";
export type GitHubIdentityVerificationStatus = "active" | "revoked";
export type GitHubIdentityVerificationMethod = "oauth_callback" | "trusted_admin";

export interface GitHubIdentityVerificationRecord {
    verification_id: string;
    status: GitHubIdentityVerificationStatus;
    verification_method: GitHubIdentityVerificationMethod;
    github_login: string;
    github_user_id?: string;
    subject_user_id?: string | null;
    contributor_identity: Extract<ContributorIdentity, { identity_level: "github_login" }>;
    verified_by?: string | null;
    note?: string;
    created_at: string;
    updated_at: string;
    verified_at: string;
    revoked_at?: string;
    revoked_by?: string | null;
    revoke_note?: string;
}

export async function listGitHubIdentityVerifications(filters: {
    status?: GitHubIdentityVerificationStatus;
    githubLogin?: string;
    subjectUserId?: string;
} = {}): Promise<GitHubIdentityVerificationRecord[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.githubLogin) params.set("githubLogin", filters.githubLogin);
    if (filters.subjectUserId) params.set("subjectUserId", filters.subjectUserId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API}/admin/identity/github/verifications${suffix}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to load GitHub identity verifications");
    return data.items ?? [];
}

export async function createGitHubIdentityVerification(input: {
    github_login: string;
    github_user_id?: string;
    subject_user_id?: string | null;
    note?: string;
}) {
    const res = await fetch(`${API}/admin/identity/github/verifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to create GitHub identity verification");
    return data as GitHubIdentityVerificationRecord;
}

export async function revokeGitHubIdentityVerification(verificationId: string, input: { revoke_note?: string } = {}) {
    const res = await fetch(`${API}/admin/identity/github/verifications/${verificationId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to revoke GitHub identity verification");
    return data as GitHubIdentityVerificationRecord;
}

// ---------------------------------------------------------------------------
// Rights grants
// ---------------------------------------------------------------------------

export type RightsRole =
    | "owner"
    | "editor"
    | "translator"
    | "reviewer"
    | "contributor"
    | "moderator"
    | "viewer"
    | "original_rights_holder"
    | "translation_reviewer"
    | "footnote_contributor"
    | "pack_maintainer"
    | "publisher";

export type RightsPermission =
    | "propose_translation"
    | "propose_footnote"
    | "edit_structure"
    | "edit_translation"
    | "review_translation"
    | "review_footnote"
    | "approve_translation"
    | "approve_footnote"
    | "publish_pack"
    | "manage_rights"
    | "moderate_proposals"
    | "commercial_use";

export type RightsUsage = "free_view" | "paid_view" | "promotional" | "commercial_distribution";

export interface RightsScope {
    series_id?: string;
    episode_id?: string;
    language?: string;
    pack_id?: string;
    usage?: RightsUsage[];
    territory?: string;
}

export interface RightsGrantRecord {
    grant_id: string;
    subject_user_id: string;
    role: RightsRole;
    permissions: RightsPermission[];
    scope: RightsScope;
    starts_at?: string;
    ends_at?: string;
    granted_by?: string | null;
    notes?: string;
    created_at: string;
    updated_at: string;
    revoked_at?: string;
}

export interface RightsGrantCreateInput {
    subject_user_id: string;
    role: RightsRole;
    permissions: RightsPermission[];
    scope: RightsScope;
    starts_at?: string;
    ends_at?: string;
    granted_by?: string | null;
    notes?: string;
}

export async function listRightsGrants(filters: {
    userId?: string;
    seriesId?: string;
    permission?: RightsPermission;
    includeRevoked?: boolean;
} = {}): Promise<RightsGrantRecord[]> {
    const params = new URLSearchParams();
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.seriesId) params.set("seriesId", filters.seriesId);
    if (filters.permission) params.set("permission", filters.permission);
    if (filters.includeRevoked) params.set("includeRevoked", "true");
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API}/admin/rights/grants${suffix}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to load rights grants");
    return data.items ?? [];
}

export async function createRightsGrant(input: RightsGrantCreateInput) {
    const res = await fetch(`${API}/admin/rights/grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to create rights grant");
    return data as RightsGrantRecord;
}

export async function revokeRightsGrant(grantId: string) {
    const res = await fetch(`${API}/admin/rights/grants/${grantId}/revoke`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to revoke rights grant");
    return data as RightsGrantRecord;
}

export async function checkRightsPermission(input: {
    user_id: string;
    permission: RightsPermission;
    scope: RightsScope;
}): Promise<{ allowed: boolean; matched_grant_ids: string[]; reason?: string }> {
    const res = await fetch(`${API}/admin/rights/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to check rights permission");
    return data;
}

export interface GitHubHandoffRecord {
    handoff_id: string;
    target_type: GitHubHandoffTargetType;
    target_id: string;
    mode: GitHubHandoffMode;
    status: GitHubHandoffStatus;
    contributor_identity?: ContributorIdentity;
    requested_by?: string | null;
    triage_group_key?: string;
    title?: string;
    body?: string;
    metadata?: Record<string, unknown>;
    github_url?: string;
    error_message?: string;
    created_at: string;
    updated_at: string;
    sent_at?: string;
}

export interface GitHubTriageDraft {
    issue_title: string;
    issue_body: string;
    handoff_ids: string[];
    items_count: number;
    generated_at: string;
    triage_group_key?: string;
}

export type GitHubHandoffSyncAttemptStatus =
    | "planned"
    | "in_progress"
    | "succeeded"
    | "retryable_failed"
    | "permanent_failed"
    | "canceled";

export interface GitHubHandoffSyncAttemptRecord {
    attempt_id: string;
    status: GitHubHandoffSyncAttemptStatus;
    handoff_ids: string[];
    selected_statuses: Array<"queued" | "ready">;
    skipped: Array<Record<string, unknown>>;
    target_repository: string;
    target_issue_number?: number;
    issue_grouping_rule?: string;
    triage_group_key?: string;
    draft: GitHubTriageDraft;
    draft_body_hash: string;
    idempotency_key: string;
    dedupe_keys: string[];
    retry_policy: {
        max_attempts: number;
        initial_backoff_seconds: number;
        max_backoff_seconds: number;
        retry_on: string[];
    };
    attempt_count: number;
    max_attempts: number;
    next_retry_at?: string;
    rate_limit_reset_at?: string;
    last_error?: string;
    github_url?: string;
    created_at: string;
    updated_at: string;
}

export interface GitHubHandoffSyncAttemptCreateInput {
    statuses?: Array<"queued" | "ready">;
    target_type?: GitHubHandoffTargetType;
    triage_group_key?: string;
    limit?: number;
    issue_title?: string;
    target_repository: string;
    target_issue_number?: number;
    issue_grouping_rule?: string;
    max_attempts?: number;
    next_retry_at?: string;
    rate_limit_reset_at?: string;
}

export type GitHubHandoffSyncAttemptUpdateStatus =
    | "in_progress"
    | "succeeded"
    | "retryable_failed"
    | "permanent_failed"
    | "canceled";

export async function listGitHubHandoffs(filters: {
    status?: GitHubHandoffStatus;
    targetType?: GitHubHandoffTargetType;
    targetId?: string;
} = {}): Promise<GitHubHandoffRecord[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.targetType) params.set("targetType", filters.targetType);
    if (filters.targetId) params.set("targetId", filters.targetId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API}/admin/github-handoffs${suffix}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to load GitHub handoffs");
    return data.items ?? [];
}

export async function listGitHubHandoffSyncAttempts(filters: {
    status?: GitHubHandoffSyncAttemptStatus;
    targetRepository?: string;
} = {}): Promise<GitHubHandoffSyncAttemptRecord[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.targetRepository) params.set("targetRepository", filters.targetRepository);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API}/admin/github-handoffs/sync-attempts${suffix}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to load GitHub handoff sync attempts");
    return data.items ?? [];
}

export async function createGitHubHandoffSyncAttempt(input: GitHubHandoffSyncAttemptCreateInput): Promise<{
    attempt: GitHubHandoffSyncAttemptRecord;
    deduped: boolean;
}> {
    const res = await fetch(`${API}/admin/github-handoffs/sync-attempts/planned`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to create GitHub handoff sync attempt");
    return data as { attempt: GitHubHandoffSyncAttemptRecord; deduped: boolean };
}

export async function updateGitHubHandoffSyncAttemptStatus(
    attemptId: string,
    input: {
        status: GitHubHandoffSyncAttemptUpdateStatus;
        attempt_count?: number;
        last_error?: string;
        next_retry_at?: string;
        rate_limit_reset_at?: string;
        github_url?: string;
    },
) {
    const res = await fetch(`${API}/admin/github-handoffs/sync-attempts/${attemptId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to update GitHub handoff sync attempt");
    return data as GitHubHandoffSyncAttemptRecord;
}

export async function createGitHubTriageDraft(input: {
    status?: GitHubHandoffStatus;
    target_type?: GitHubHandoffTargetType;
    triage_group_key?: string;
    limit?: number;
    issue_title?: string;
} = {}): Promise<GitHubTriageDraft> {
    const res = await fetch(`${API}/admin/github-handoffs/triage-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to generate GitHub triage draft");
    return data as GitHubTriageDraft;
}

export async function getGitHubHandoff(handoffId: string): Promise<GitHubHandoffRecord | null> {
    const res = await fetch(`${API}/admin/github-handoffs/${handoffId}`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
}

export async function updateGitHubHandoffStatus(
    handoffId: string,
    input: { status: GitHubHandoffStatus; github_url?: string; error_message?: string },
) {
    const res = await fetch(`${API}/admin/github-handoffs/${handoffId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to update GitHub handoff");
    return data as GitHubHandoffRecord;
}

export async function createFeedbackGitHubHandoff(feedbackId: string, input: {
    mode?: GitHubHandoffMode;
    triage_group_key?: string;
    title?: string;
    body?: string;
} = {}) {
    const res = await fetch(`${API}/admin/feedback/${feedbackId}/github-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to create GitHub handoff");
    return data as GitHubHandoffRecord;
}

export async function createProposalGitHubHandoff(proposalId: string, input: {
    mode?: GitHubHandoffMode;
    triage_group_key?: string;
    title?: string;
    body?: string;
} = {}) {
    const res = await fetch(`${API}/admin/proposals/${proposalId}/github-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to create GitHub handoff");
    return data as GitHubHandoffRecord;
}

// ---------------------------------------------------------------------------
// Pack drafts
// ---------------------------------------------------------------------------

export type PackType = "TRANSLATION" | "FOOTNOTE" | "COMMENTARY" | "LEARNING" | "ACCESSIBILITY";
export type PackClass = "proposal" | "draft" | "official" | "deprecated";
export type PackDraftStatus = "draft" | "in_review" | "approved" | "published" | "archived";
export type TranslationOrigin = "machine" | "human" | "imported";

export interface PackDraftEntry {
    entry_id: string;
    source_proposal_id?: string | null;
    target: {
        series_id: string;
        episode_id?: string | null;
        page_id?: string | null;
        panel_id?: string | null;
        bubble_id?: string | null;
    };
    lang?: string;
    original_text?: string;
    current_translation?: string;
    text?: string;
    note?: string;
    metadata?: {
        translation_origin?: TranslationOrigin;
        provider?: string;
        model?: string;
        confidence?: number;
        generated_at?: string;
        [key: string]: unknown;
    };
    text_layout?: BubbleTextLayout;
    text_style?: BubbleTextStyle;
    adopted_at: string;
    adopted_by?: string | null;
}

export interface PackDraftRecord {
    pack_draft_id: string;
    type: PackType;
    title: string;
    language?: string;
    target_series_id?: string;
    target_episode_id?: string;
    version: number;
    status: PackDraftStatus;
    entries: PackDraftEntry[];
    created_by?: string | null;
    created_at: string;
    updated_at: string;
    reviewed_by?: string | null;
    reviewed_at?: string;
}

export type TranslationImportSourceFormat = "json" | "csv";
export type TranslationImportIssueKind =
    | "unmatched_bubble"
    | "duplicate_bubble"
    | "missing_bubble"
    | "source_text_mismatch"
    | "existing_entry_conflict"
    | "invalid_pack_draft";
export type TranslationImportIssueSeverity = "error" | "warning";

export interface TranslationPackDraftImportEntry {
    bubble_id: string;
    text?: string;
    suggested_text?: string;
    source_text?: string;
    current_translation?: string;
    page_id?: string;
    panel_id?: string | null;
    row_number?: number;
    row_ref?: string;
    comment?: string;
    translation_origin?: TranslationOrigin;
    provider?: string;
    model?: string;
    confidence?: number;
    generated_at?: string;
}

export interface TranslationImportIssue {
    kind: TranslationImportIssueKind;
    severity: TranslationImportIssueSeverity;
    bubble_id?: string;
    page_id?: string;
    panel_id?: string | null;
    row_number?: number;
    row_ref?: string;
    message: string;
}

export interface TranslationImportSummary {
    total_canonical_bubbles: number;
    total_import_rows: number;
    matched_rows: number;
    planned_entries: number;
    unmatched_bubbles: number;
    duplicate_bubbles: number;
    missing_bubbles: number;
    existing_entry_conflicts: number;
    error_count: number;
    warning_count: number;
}

export interface TranslationPackDraftImportPlan {
    series_id: string;
    episode_id: string;
    lang: string;
    source_format: TranslationImportSourceFormat;
    can_apply: boolean;
    summary: TranslationImportSummary;
    issues: TranslationImportIssue[];
    planned_entries: PackDraftEntry[];
}

export interface TranslationPackDraftImportResponse {
    applied: boolean;
    result: TranslationPackDraftImportPlan;
    record?: PackDraftRecord;
}

export async function listPackDrafts(filters: { status?: PackDraftStatus; type?: PackType; seriesId?: string } = {}): Promise<PackDraftRecord[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
    if (filters.seriesId) params.set("seriesId", filters.seriesId);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`${API}/admin/pack-drafts${suffix}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to load pack drafts");
    return data.items ?? [];
}

export async function patchPackDraftEntryLettering(packDraftId: string, entryId: string, input: {
    textLayout?: BubbleTextLayout | Record<string, never>;
    textStyle?: BubbleTextStyle | Record<string, never>;
}) {
    const res = await fetch(`${API}/admin/pack-drafts/${packDraftId}/entries/${entryId}/lettering`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to patch Pack Draft lettering");
    return data as { record: PackDraftRecord; entry: PackDraftEntry };
}

export async function createPackDraft(input: {
    type: PackType;
    title: string;
    language?: string;
    target_series_id?: string;
    target_episode_id?: string;
    version?: number;
}) {
    const res = await fetch(`${API}/admin/pack-drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to create pack draft");
    return data as PackDraftRecord;
}

export async function getPackDraft(packDraftId: string): Promise<PackDraftRecord | null> {
    const res = await fetch(`${API}/admin/pack-drafts/${packDraftId}`, { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
}

export async function updatePackDraftStatus(packDraftId: string, status: PackDraftStatus) {
    const res = await fetch(`${API}/admin/pack-drafts/${packDraftId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to update pack draft");
    return data as PackDraftRecord;
}

export async function adoptProposalIntoPackDraft(packDraftId: string, proposalId: string) {
    const res = await fetch(`${API}/admin/pack-drafts/${packDraftId}/adopt-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ proposal_id: proposalId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to adopt proposal");
    return data as PackDraftRecord;
}

export async function exportPackDraft(packDraftId: string, input: {
    pack_id: string;
    pack_class?: PackClass;
    title?: string;
    author_label?: string;
    is_published?: boolean;
    overwrite?: boolean;
}) {
    const res = await fetch(`${API}/admin/pack-drafts/${packDraftId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to export pack draft");
    return data as {
        exported: true;
        path: string;
        pack: {
            id: string;
            type: PackType;
            packClass?: PackClass;
            isPublished: boolean;
            entries: unknown[];
        };
    };
}

export async function importTranslationPackDraft(packDraftId: string, input: {
    series_id: string;
    episode_id: string;
    lang: string;
    source_format: TranslationImportSourceFormat;
    entries: TranslationPackDraftImportEntry[];
    apply?: boolean;
}): Promise<TranslationPackDraftImportResponse> {
    const res = await fetch(`${API}/admin/pack-drafts/${packDraftId}/translation-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) {
        if (data.result) return data as TranslationPackDraftImportResponse;
        throw new Error(data.error?.message ?? "Failed to import translations");
    }
    return data as TranslationPackDraftImportResponse;
}

export async function updateDraft(jobId: string, draft: DraftPayload) {
    const res = await fetch(`${API}/admin/ingestion/jobs/${jobId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to update draft");
    return data;
}

export async function submitForReview(jobId: string) {
    const res = await fetch(`${API}/admin/ingestion/jobs/${jobId}/submit`, { method: "POST", credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Submit failed");
    return data;
}

export async function confirmJob(jobId: string) {
    const res = await fetch(`${API}/admin/ingestion/jobs/${jobId}/confirm`, { method: "POST", credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Confirm failed");
    return data;
}

export async function cancelJob(jobId: string) {
    const res = await fetch(`${API}/admin/ingestion/jobs/${jobId}/cancel`, { method: "POST", credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Cancel failed");
    return data;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function jsonOrEmpty(res: Response) {
    try {
        return await res.json();
    } catch {
        return {};
    }
}

function apiErrorMessage(data: any, fallback: string) {
    return data?.error?.message ?? data?.message ?? fallback;
}

export async function devLogin(userId?: string, name?: string, role?: string) {
    const res = await fetch(`${API}/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, name, role }),
    });
    const data = await jsonOrEmpty(res);
    if (!res.ok) throw new Error(apiErrorMessage(data, "Login failed"));
    return data as { token: string; user: { id: string; name: string; role: string } };
}

export async function requestLoginLink(email: string) {
    const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
    });
    const data = await jsonOrEmpty(res);
    if (!res.ok) throw new Error(apiErrorMessage(data, "Login link request failed"));
    return data as { ok: true; message: string };
}

export async function getMe() {
    const res = await fetch(`${API}/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.authenticated ? data.user as { id: string; name: string; role: string } : null;
}

export async function logout() {
    const res = await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
    });
    const data = await jsonOrEmpty(res);
    if (!res.ok) throw new Error(apiErrorMessage(data, "Logout failed"));
    return data as { ok: true };
}

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

export interface EntitlementItem {
    id: string;
    userId: string;
    targetType: string;
    targetId: string;
    source: string;
    status: string;
    grantedAt: string;
}

export async function grantEntitlement(input: {
    userId: string;
    targetType?: string;
    targetId: string;
    source?: string;
}) {
    const res = await fetch(`${API}/admin/entitlements/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Grant failed");
    return data as EntitlementItem;
}

export async function listEntitlements(userId: string): Promise<EntitlementItem[]> {
    const res = await fetch(`${API}/admin/entitlements/list?userId=${encodeURIComponent(userId)}`, { credentials: "include" });
    const data = await res.json();
    return data.items ?? [];
}

export async function revokeEntitlement(entitlementId: string) {
    const res = await fetch(`${API}/admin/entitlements/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entitlementId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Revoke failed");
    return data;
}
