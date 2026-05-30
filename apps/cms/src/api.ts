const API = "/api/v1";

export interface SeriesItem {
    id: string;
    title: string;
    description: string;
    status: string;
    coverUrl: string;
    shareImageUrl?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
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
    status: string;
    coverUrl: string;
    shareImageUrl?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    episodes: EpisodeSummary[];
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface BubbleData {
    id: string;
    bubbleNumber: number;
    shortId: string;
    bubbleType: "speech" | "thought" | "narration" | "sfx" | "caption" | "other";
    textOriginal: string;
    speaker?: string;
    speakerConfidence?: "confirmed" | "inferred" | "unknown";
    textDirection?: "horizontal" | "vertical";
    lang?: string;
    flags?: ContentFlags;
    bbox: BoundingBox;
}

export interface ContentFlags {
    shareable: boolean;
    feedback_enabled: boolean;
    contains_spoiler?: boolean;
}

export interface PanelData {
    id: string;
    panelNumber: number;
    bbox: BoundingBox;
    reactionTags: string[];
    flags?: ContentFlags;
    bubbles: BubbleData[];
}

export interface PageData {
    id: string;
    pageNumber: number;
    displayRef?: string;
    images: Record<string, string>;
    width: number;
    height: number;
    flags?: ContentFlags;
    panels: PanelData[];
}

export interface EpisodeData {
    id: string;
    episodeNumber: number;
    title: string;
    publishedAt: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
    pages: PageData[];
}

export async function listSeries(): Promise<SeriesItem[]> {
    const res = await fetch(`${API}/admin/series`, { credentials: "include" });
    if (!res.ok) return listPublicSeries();
    const data = await res.json();
    return data.items ?? [];
}

async function listPublicSeries(): Promise<SeriesItem[]> {
    const res = await fetch(`${API}/series`);
    const data = await res.json();
    return data.items ?? [];
}

export async function getSeries(id: string): Promise<SeriesDetail | null> {
    const res = await fetch(`${API}/admin/series/${id}`, { credentials: "include" });
    if (!res.ok) return getPublicSeries(id);
    return res.json();
}

async function getPublicSeries(id: string): Promise<SeriesDetail | null> {
    const res = await fetch(`${API}/series/${id}`);
    if (!res.ok) return null;
    return res.json();
}

export async function createSeries(input: {
    id: string;
    title: string;
    description?: string;
    status?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
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
    status?: string;
    publishStartAt?: string;
    publishEndAt?: string;
    visibility?: PublicationVisibility;
}) {
    const res = await fetch(`${API}/admin/series/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to update series");
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
    const res = await fetch(`${API}/admin/series/${seriesId}/episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message ?? "Failed to save episode");
    return data;
}

export async function getAdminEpisode(seriesId: string, episodeId: string): Promise<EpisodeData | null> {
    const res = await fetch(`${API}/admin/series/${seriesId}/episodes/${episodeId}`, {
        credentials: "include",
    });
    if (!res.ok) return null;
    return res.json();
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

export async function devLogin(userId?: string, name?: string, role?: string) {
    const res = await fetch(`${API}/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, name, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error("Login failed");
    return data as { token: string; user: { id: string; name: string; role: string } };
}

export async function getMe() {
    const res = await fetch(`${API}/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.authenticated ? data.user as { id: string; name: string; role: string } : null;
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
