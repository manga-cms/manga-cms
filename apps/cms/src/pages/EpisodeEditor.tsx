import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { saveEpisode, getSeries, getAdminEpisode, uploadAdminPageImage, type PageData, type PublicationVisibility } from "../api";
import {
    getPublicationState,
    publicationInputPayload,
    toLocalDateTimeInput,
    type PublicationFormState,
} from "../publication";

interface PageInput {
    id?: string;
    pageNumber: number;
    imagePath: string;
    displayRef?: string;
    width: number;
    height: number;
    images?: PageData["images"];
    flags?: PageData["flags"];
    panels: PageData["panels"];
}

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

export default function EpisodeEditor() {
    const { id: seriesId, epId } = useParams<{ id: string; epId: string }>();
    const nav = useNavigate();

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

    // Load existing episode data if it exists
    useEffect(() => {
        if (!seriesId) return;
        getSeries(seriesId).then((detail) => {
            if (!detail) { setLoaded(true); return; }
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
                            setPages(pages.map((p) => ({
                                id: p.id,
                                pageNumber: p.pageNumber,
                                imagePath: p.images?.ja ?? `pages/p${String(p.pageNumber).padStart(2, "0")}.jpg`,
                                displayRef: p.displayRef,
                                width: p.width,
                                height: p.height,
                                images: p.images,
                                flags: p.flags,
                                panels: p.panels ?? [],
                            })));
                        } else if (episodeSummary.pageCount > 0) {
                            // Fallback: create page stubs
                            setPages(makePageStubs(episodeSummary.pageCount));
                        }
                        setLoaded(true);
                    })
                    .catch(() => {
                        setPages(makePageStubs(episodeSummary.pageCount));
                        setLoaded(true);
                    });
            } else {
                // New episode — add one default page
                setPublishedAt(new Date().toISOString().slice(0, 10));
                setPages([{ pageNumber: 1, imagePath: "pages/p01.jpg", width: 500, height: 760, panels: [] }]);
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

    const removePage = (idx: number) => {
        setPages(pages.filter((_, i) => i !== idx));
    };

    const handleImageUpload = async (idx: number, file: File | undefined) => {
        if (!seriesId || !epId || !file) return;
        const page = pages[idx];
        if (!page) return;
        setUploadingPage(page.pageNumber);
        setError("");
        try {
            const result = await uploadAdminPageImage(seriesId, epId, page.pageNumber, file);
            setPages((current) => current.map((p, pageIndex) => pageIndex === idx
                ? { ...p, imagePath: result.imagePath, images: { ...(p.images ?? {}), ja: result.imagePath } }
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

        // Preserve existing panels when saving
        const fullPages = pages.map((p) => ({
            id: p.id ?? generateId(seriesId, epId, p.pageNumber),
            pageNumber: p.pageNumber,
            displayRef: p.displayRef?.trim() || undefined,
            images: { ...p.images, ja: p.imagePath },
            width: p.width,
            height: p.height,
            flags: p.flags,
            panels: p.panels ?? [],
        }));

        setSaving(true);
        setError("");
        try {
            await saveEpisode(seriesId, {
                id: epId,
                episodeNumber: epNum,
                title: epTitle || epId,
                publishedAt: publishedAt || new Date().toISOString().slice(0, 10),
                ...publicationInputPayload(episodeSchedule),
                pages: fullPages,
            });
            nav(`/works/${seriesId}`);
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

    return (
        <div>
            <h1>Episode Editor: {epId}</h1>
            <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
                {seriesId} / {epId}
            </p>

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
                            <h2>Publication</h2>
                            <p className="card-meta">Episode availability still depends on the parent Series being public.</p>
                        </div>
                        <span className={`badge publication-${episodePublicationState}`}>{episodePublicationState}</span>
                    </div>
                    <div className="publication-grid">
                        <div className="form-group">
                            <label>Visibility</label>
                            <select
                                value={episodeSchedule.visibility}
                                onChange={(e) => setEpisodeSchedule((current) => ({ ...current, visibility: e.target.value as PublicationVisibility }))}
                            >
                                <option value="public">Public</option>
                                <option value="hidden">Hidden</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Publish Start</label>
                            <input
                                type="datetime-local"
                                value={episodeSchedule.publishStartAt}
                                onChange={(e) => setEpisodeSchedule((current) => ({ ...current, publishStartAt: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Publish End</label>
                            <input
                                type="datetime-local"
                                value={episodeSchedule.publishEndAt}
                                onChange={(e) => setEpisodeSchedule((current) => ({ ...current, publishEndAt: e.target.value }))}
                            />
                        </div>
                    </div>
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
                        <div className="page-editor-grid">
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Image Path</label>
                                <input value={p.imagePath} onChange={(e) => updatePage(idx, "imagePath", e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Upload Image</label>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    disabled={uploadingPage === p.pageNumber}
                                    onChange={(e) => handleImageUpload(idx, e.currentTarget.files?.[0])}
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
                                {p.panels.reduce((count, panel) => count + panel.bubbles.length, 0)} bubbles across {p.panels.length} panels
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
