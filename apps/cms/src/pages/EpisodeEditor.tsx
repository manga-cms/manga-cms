import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
    saveEpisode,
    getSeries,
    getAdminEpisode,
    uploadAdminPageImage,
    type EpisodeData,
    type PageData,
    type PublicationVisibility,
    type SeriesPublicationType,
} from "../api";
import { TextExportMenu } from "../components/TextExportMenu";
import { useTranslation } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";
import {
    getPublicationState,
    publicationInputPayload,
    toLocalDateTimeInput,
    type PublicationFormState,
} from "../publication";

interface PageInput {
    id?: string;
    pageId?: string;
    stableRef?: string;
    pageNumber: number;
    imagePath: string;
    displayRef?: string;
    width: number;
    height: number;
    images?: PageData["images"];
    imageId?: string;
    imageHash?: string;
    coordinateSpace?: PageData["coordinateSpace"];
    status?: PageData["status"];
    flags?: PageData["flags"];
    panels: PageData["panels"];
    bubbles?: PageData["bubbles"];
}

type PageImageLocale = "ja" | "en";

const publicationStateLabelKey = (state: string): MessageKey => `publication.state.${state}` as MessageKey;

function generateId(seriesId: string, epId: string, pageNum: number) {
    return `${seriesId}-${epId}-p${String(pageNum).padStart(2, "0")}`;
}

function makePageStubs(count: number): PageInput[] {
    return Array.from({ length: count }, (_, i) => ({
        pageNumber: i + 1,
        imagePath: `pages/p${String(i + 1).padStart(2, "0")}.jpg`,
        width: 500,
        height: 760,
        panels: [],
    }));
}

function buildEpisodeDraft({
    seriesId,
    epId,
    epNum,
    epTitle,
    publishedAt,
    pages,
}: {
    seriesId: string;
    epId: string;
    epNum: number;
    epTitle: string;
    publishedAt: string;
    pages: PageInput[];
}): EpisodeData {
    return {
        id: epId,
        episodeNumber: epNum,
        title: epTitle || epId,
        publishedAt: publishedAt || new Date().toISOString().slice(0, 10),
        pages: pages.map((p) => ({
            id: p.id ?? generateId(seriesId, epId, p.pageNumber),
            pageId: p.pageId ?? p.id ?? generateId(seriesId, epId, p.pageNumber),
            stableRef: p.stableRef ?? p.pageId ?? p.id ?? generateId(seriesId, epId, p.pageNumber),
            pageNumber: p.pageNumber,
            displayRef: p.displayRef?.trim() || undefined,
            images: { ...p.images, ja: p.imagePath },
            imageId: p.imageId,
            imageHash: p.imageHash,
            coordinateSpace: p.coordinateSpace,
            width: p.width,
            height: p.height,
            status: p.status,
            flags: p.flags,
            panels: p.panels ?? [],
            bubbles: p.bubbles ?? [],
        })),
    };
}

type EpisodePreviewUrlParams = {
    seriesId?: string;
    episodeId?: string;
    packDraftId?: string;
};

const VIEWER_PREVIEW_BASE = import.meta.env.VITE_VIEWER_PREVIEW_BASE ?? import.meta.env.VITE_VIEWER_BASE ?? "";

export function buildEpisodePreviewUrl({ seriesId, episodeId, packDraftId }: EpisodePreviewUrlParams) {
    if (!seriesId || !episodeId) return "";
    const query = new URLSearchParams();
    const trimmedPackDraftId = packDraftId?.trim();
    if (trimmedPackDraftId) {
        query.set("packDraftId", trimmedPackDraftId);
    }
    const path = `/works/${encodeURIComponent(seriesId)}/episodes/${encodeURIComponent(episodeId)}`;
    const queryString = query.toString();
    return `${VIEWER_PREVIEW_BASE}${path}${queryString ? `?${queryString}` : ""}`;
}

function withPreviewReloadKey(url: string, reloadKey: number) {
    if (!url) return "";
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}cmsPreviewReload=${reloadKey}`;
}

export default function EpisodeEditor() {
    const { id: seriesId, epId } = useParams<{ id: string; epId: string }>();
    const nav = useNavigate();
    const { t } = useTranslation();

    const [epTitle, setEpTitle] = useState("");
    const [epNum, setEpNum] = useState(1);
    const [publishedAt, setPublishedAt] = useState("");
    const [episodeSchedule, setEpisodeSchedule] = useState<PublicationFormState>({
        visibility: "public",
        publishStartAt: "",
        publishEndAt: "",
    });
    const [pages, setPages] = useState<PageInput[]>([]);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [uploadingPage, setUploadingPage] = useState<number | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [previewReloadKey, setPreviewReloadKey] = useState(0);
    const [previewPackDraftId, setPreviewPackDraftId] = useState("");
    const [seriesTitle, setSeriesTitle] = useState("");
    const [seriesPublicationType, setSeriesPublicationType] = useState<SeriesPublicationType>("serial");
    const [baselineExportSnapshot, setBaselineExportSnapshot] = useState("");

    // Load existing episode data if it exists
    useEffect(() => {
        if (!seriesId) return;
        getSeries(seriesId).then((detail) => {
            if (!detail) { setLoaded(true); return; }
            setSeriesTitle(detail.title);
            setSeriesPublicationType(detail.publicationType ?? "serial");
            const episodeSummary = detail.episodes.find((e) => e.id === epId);
            if (episodeSummary) {
                setEpTitle(episodeSummary.title);
                setEpNum(episodeSummary.episodeNumber);
                setPublishedAt(episodeSummary.publishedAt);
                setEpisodeSchedule({
                    visibility: episodeSummary.visibility ?? "public",
                    publishStartAt: toLocalDateTimeInput(episodeSummary.publishStartAt),
                    publishEndAt: toLocalDateTimeInput(episodeSummary.publishEndAt),
                });
                getAdminEpisode(seriesId, epId!)
                    .then((adminEpisode) => {
                        if (adminEpisode) {
                            setPublishedAt(adminEpisode.publishedAt);
                            setEpisodeSchedule({
                                visibility: adminEpisode.visibility ?? "public",
                                publishStartAt: toLocalDateTimeInput(adminEpisode.publishStartAt),
                                publishEndAt: toLocalDateTimeInput(adminEpisode.publishEndAt),
                            });
                        }
                        const pages = adminEpisode?.pages ?? [];
                        if (pages.length) {
                            const nextPages = pages.map((p) => ({
                                id: p.id,
                                pageId: p.pageId,
                                stableRef: p.stableRef,
                                pageNumber: p.pageNumber,
                                imagePath: p.images?.ja ?? `pages/p${String(p.pageNumber).padStart(2, "0")}.jpg`,
                                displayRef: p.displayRef,
                                width: p.width,
                                height: p.height,
                                images: p.images,
                                imageId: p.imageId,
                                imageHash: p.imageHash,
                                coordinateSpace: p.coordinateSpace,
                                status: p.status,
                                flags: p.flags,
                                panels: p.panels ?? [],
                                bubbles: p.bubbles ?? [],
                            }));
                            setPages(nextPages);
                            setBaselineExportSnapshot(JSON.stringify(buildEpisodeDraft({
                                seriesId,
                                epId: epId!,
                                epNum: adminEpisode?.episodeNumber ?? episodeSummary.episodeNumber,
                                epTitle: adminEpisode?.title ?? episodeSummary.title,
                                publishedAt: adminEpisode?.publishedAt ?? episodeSummary.publishedAt,
                                pages: nextPages,
                            })));
                        } else if (episodeSummary.pageCount > 0) {
                            // Fallback: create page stubs
                            const nextPages = makePageStubs(episodeSummary.pageCount);
                            setPages(nextPages);
                            setBaselineExportSnapshot(JSON.stringify(buildEpisodeDraft({
                                seriesId,
                                epId: epId!,
                                epNum: episodeSummary.episodeNumber,
                                epTitle: episodeSummary.title,
                                publishedAt: episodeSummary.publishedAt,
                                pages: nextPages,
                            })));
                        }
                        setLoaded(true);
                    })
                    .catch(() => {
                        const nextPages = makePageStubs(episodeSummary.pageCount);
                        setPages(nextPages);
                        setBaselineExportSnapshot(JSON.stringify(buildEpisodeDraft({
                            seriesId,
                            epId: epId!,
                            epNum: episodeSummary.episodeNumber,
                            epTitle: episodeSummary.title,
                            publishedAt: episodeSummary.publishedAt,
                            pages: nextPages,
                        })));
                        setLoaded(true);
                    });
            } else {
                // New episode — add one default page
                const nextPublishedAt = new Date().toISOString().slice(0, 10);
                const nextPages = [{ pageNumber: 1, imagePath: "pages/p01.jpg", width: 500, height: 760, panels: [] }];
                setPublishedAt(new Date().toISOString().slice(0, 10));
                setPages(nextPages);
                setBaselineExportSnapshot(JSON.stringify(buildEpisodeDraft({
                    seriesId,
                    epId: epId!,
                    epNum: 1,
                    epTitle: "",
                    publishedAt: nextPublishedAt,
                    pages: nextPages,
                })));
                setLoaded(true);
            }
        });
    }, [seriesId, epId]);

    const addPage = () => {
        const nextNum = pages.length + 1;
        setPages([...pages, {
            pageNumber: nextNum,
            imagePath: `pages/p${String(nextNum).padStart(2, "0")}.jpg`,
            width: 500,
            height: 760,
            panels: [],
        }]);
    };

    const updatePage = (idx: number, field: keyof PageInput, value: string | number | undefined) => {
        const updated = [...pages];
        updated[idx] = { ...updated[idx], [field]: value };
        setPages(updated);
    };

    const updatePageImagePath = (idx: number, locale: PageImageLocale, value: string) => {
        setPages((current) => current.map((page, pageIndex) => {
            if (pageIndex !== idx) return page;
            const nextImages = { ...(page.images ?? {}) };
            const trimmed = value.trim();
            if (trimmed) {
                nextImages[locale] = trimmed;
            } else {
                delete nextImages[locale];
            }
            return {
                ...page,
                imagePath: locale === "ja" ? value : page.imagePath,
                images: nextImages,
            };
        }));
    };

    const removePage = (idx: number) => {
        setPages(pages.filter((_, i) => i !== idx));
    };

    const handleImageUpload = async (idx: number, locale: PageImageLocale, file: File | undefined) => {
        if (!seriesId || !epId || !file) return;
        const page = pages[idx];
        if (!page) return;
        setUploadingPage(page.pageNumber);
        setError("");
        try {
            const result = await uploadAdminPageImage(seriesId, epId, page.pageNumber, file, locale);
            setPages((current) => current.map((p, pageIndex) => pageIndex === idx
                ? {
                    ...p,
                    imagePath: locale === "ja" ? result.imagePath : p.imagePath,
                    images: { ...(p.images ?? {}), [locale]: result.imagePath },
                }
                : p));
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setUploadingPage(null);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!seriesId || !epId) return;

        // Preserve existing panels when saving.
        const draftEpisode = buildEpisodeDraft({ seriesId, epId, epNum, epTitle, publishedAt, pages });

        setSaving(true);
        setError("");
        setSaveMessage("");
        try {
            await saveEpisode(seriesId, {
                id: epId,
                episodeNumber: epNum,
                title: epTitle || epId,
                publishedAt: publishedAt || new Date().toISOString().slice(0, 10),
                ...publicationInputPayload(episodeSchedule),
                pages: draftEpisode.pages,
            });
            setBaselineExportSnapshot(JSON.stringify(draftEpisode));
            setSaveMessage(t("episode.preview.saved"));
            setPreviewReloadKey((current) => current + 1);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (!loaded) return <p style={{ color: "var(--muted)" }}>Loading episode…</p>;
    const episodePublicationState = getPublicationState({
        visibility: episodeSchedule.visibility,
        publishStartAt: publicationInputPayload(episodeSchedule).publishStartAt,
        publishEndAt: publicationInputPayload(episodeSchedule).publishEndAt,
    });
    const previewUrl = buildEpisodePreviewUrl({ seriesId, episodeId: epId, packDraftId: previewPackDraftId });
    const previewFrameSrc = withPreviewReloadKey(previewUrl, previewReloadKey);
    const exportEpisode = seriesId && epId ? buildEpisodeDraft({ seriesId, epId, epNum, epTitle, publishedAt, pages }) : null;
    const exportDirty = Boolean(exportEpisode && baselineExportSnapshot && JSON.stringify(exportEpisode) !== baselineExportSnapshot);

    return (
        <div>
            <h1>Episode Editor: {epId}</h1>
            <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
                {seriesId} / {epId}
            </p>
            {seriesPublicationType === "oneshot" && (
                <div className="info-msg">
                    この作品は読切です。Reader 表示では Episode 1 という番号表記を強制せず、作品タイトルまたは localized title を優先します。
                </div>
            )}
            <div className="section-actions" style={{ marginBottom: "1rem" }}>
                <Link to={`/works/${seriesId}/episodes/${epId}/structure`} className="btn btn-outline">Structure Review</Link>
                <Link to={`/works/${seriesId}/episodes/${epId}/translation-import`} className="btn btn-outline">EN Translation import</Link>
                <TextExportMenu seriesId={seriesId} seriesTitle={seriesTitle} episode={exportEpisode} dirty={exportDirty} />
            </div>

            <form onSubmit={handleSave}>
                <div className="card" style={{ maxWidth: "28rem", marginBottom: "1.5rem" }}>
                    <div className="form-group">
                        <label>Episode Title</label>
                        <input value={epTitle} onChange={(e) => setEpTitle(e.target.value)} placeholder={epId} />
                    </div>
                    <div className="form-group">
                        <label>Episode Number</label>
                        <input type="number" min={1} value={epNum} onChange={(e) => setEpNum(Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                        <label>Published At</label>
                        <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
                    </div>
                </div>

                <div className="card publication-card" style={{ maxWidth: "42rem", marginBottom: "1.5rem" }}>
                    <div className="section-heading">
                        <div>
                            <h2>{t("work.publication.title")}</h2>
                            <p className="card-meta">{t("episode.publication.description")}</p>
                        </div>
                        <span className={`badge publication-${episodePublicationState}`}>{t(publicationStateLabelKey(episodePublicationState))}</span>
                    </div>
                    <div className="publication-grid">
                        <div className="form-group">
                            <label>{t("work.publication.visibility")}</label>
                            <select
                                value={episodeSchedule.visibility}
                                onChange={(e) => setEpisodeSchedule((current) => ({ ...current, visibility: e.target.value as PublicationVisibility }))}
                            >
                                <option value="public">{t("publication.state.public")}</option>
                                <option value="hidden">{t("publication.state.hidden")}</option>
                                <option value="archived">{t("publication.state.archived")}</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>{t("work.publication.start")}</label>
                            <input
                                type="datetime-local"
                                value={episodeSchedule.publishStartAt}
                                onChange={(e) => setEpisodeSchedule((current) => ({ ...current, publishStartAt: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t("work.publication.end")}</label>
                            <input
                                type="datetime-local"
                                value={episodeSchedule.publishEndAt}
                                onChange={(e) => setEpisodeSchedule((current) => ({ ...current, publishEndAt: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                <div className="card episode-preview-card">
                    <div className="section-heading">
                        <div>
                            <h2>{t("episode.preview.title")}</h2>
                            <p className="card-meta">{t("episode.preview.description")}</p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-outline"
                            disabled={!previewUrl}
                            onClick={() => setPreviewReloadKey((current) => current + 1)}
                        >
                            {t("episode.preview.reload")}
                        </button>
                    </div>
                    <div className="episode-preview-grid">
                        <div className="episode-preview-url">
                            <span>{t("episode.preview.url")}</span>
                            <code>{previewUrl || "-"}</code>
                        </div>
                        <div className="form-group episode-preview-draft">
                            <label>{t("episode.preview.packDraft")}</label>
                            <input
                                value={previewPackDraftId}
                                onChange={(e) => setPreviewPackDraftId(e.target.value)}
                                placeholder={t("episode.preview.packDraftPlaceholder")}
                            />
                        </div>
                    </div>
                    {previewFrameSrc ? (
                        <div className="episode-preview-frame-shell">
                            <iframe
                                key={previewFrameSrc}
                                className="episode-preview-frame"
                                title={t("episode.preview.iframeTitle")}
                                src={previewFrameSrc}
                            />
                        </div>
                    ) : (
                        <p className="card-meta">{t("episode.preview.unavailable")}</p>
                    )}
                </div>

                <h2>Pages ({pages.length})</h2>
                {pages.map((p, idx) => (
                    <div key={idx} className="card" style={{ marginBottom: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                            <span className="badge">Page {p.pageNumber}</span>
                            {p.panels.length > 0 && (
                                <span className="badge badge-ok" style={{ fontSize: "0.65rem" }}>
                                    {p.panels.length} panels
                                </span>
                            )}
                            <button type="button" onClick={() => removePage(idx)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8125rem" }}>
                                削除
                            </button>
                        </div>
                        <div className="page-image-status-row">
                            <span className={`badge ${p.images?.ja || p.imagePath ? "badge-ok" : "badge-warn"}`}>
                                JA image {p.images?.ja || p.imagePath ? "あり" : "なし"}
                            </span>
                            <span className={`badge ${p.images?.en ? "badge-ok" : "badge-warn"}`}>
                                EN image {p.images?.en ? "あり" : "なし"}
                            </span>
                        </div>
                        <div className="page-editor-grid page-editor-grid-wide">
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Japanese image path（Page.images.ja）</label>
                                <input value={p.images?.ja ?? p.imagePath} onChange={(e) => updatePageImagePath(idx, "ja", e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Japanese image upload</label>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    disabled={uploadingPage === p.pageNumber}
                                    onChange={(e) => handleImageUpload(idx, "ja", e.currentTarget.files?.[0])}
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>English image path（Page.images.en）</label>
                                <input
                                    value={p.images?.en ?? ""}
                                    onChange={(e) => updatePageImagePath(idx, "en", e.target.value)}
                                    placeholder="pages/p01.en.png"
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>English image upload</label>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    disabled={uploadingPage === p.pageNumber}
                                    onChange={(e) => handleImageUpload(idx, "en", e.currentTarget.files?.[0])}
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Display Ref</label>
                                <input value={p.displayRef ?? ""} onChange={(e) => updatePage(idx, "displayRef", e.target.value || undefined)} placeholder={`P${p.pageNumber}`} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Width</label>
                                <input type="number" value={p.width} onChange={(e) => updatePage(idx, "width", Number(e.target.value))} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Height</label>
                                <input type="number" value={p.height} onChange={(e) => updatePage(idx, "height", Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="page-editor-footer">
                            <span className="card-meta">
                                {(p.bubbles?.length
                                    ? p.bubbles.filter((bubble) => bubble.panelId !== null).length
                                    : p.panels.reduce((count, panel) => count + panel.bubbles.length, 0))} bubbles across {p.panels.length} panels
                            </span>
                            <Link to={`/works/${seriesId}/episodes/${epId}/structure`} className="btn btn-outline">
                                Review structure
                            </Link>
                        </div>
                    </div>
                ))}

                <button type="button" onClick={addPage} className="btn btn-outline" style={{ marginBottom: "1.5rem" }}>
                    + ページを追加
                </button>

                {error && <div className="error-msg">{error}</div>}
                {saveMessage && <div className="success-msg">{saveMessage}</div>}

                <div className="section-actions">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "保存中…" : "エピソードを保存"}
                    </button>
                    <Link to={`/works/${seriesId}/episodes/${epId}/structure`} className="btn btn-outline">
                        コマ/フキダシを編集
                    </Link>
                    <button type="button" onClick={() => nav(`/works/${seriesId}`)} className="btn btn-outline">
                        戻る
                    </button>
                </div>
            </form>
        </div>
    );
}
