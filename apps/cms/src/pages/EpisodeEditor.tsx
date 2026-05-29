import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { saveEpisode, getSeries, getAdminEpisode, type PageData } from "../api";

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
    const [pages, setPages] = useState<PageInput[]>([]);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
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
                getAdminEpisode(seriesId, epId!)
                    .then((adminEpisode) => {
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
