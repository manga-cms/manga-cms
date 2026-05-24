import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { getSeries, saveEpisode, type SeriesDetail } from "../api";

export default function WorkDetail() {
    const { id } = useParams<{ id: string }>();
    const nav = useNavigate();
    const [work, setWork] = useState<SeriesDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Add episode form
    const [showForm, setShowForm] = useState(false);
    const [epId, setEpId] = useState("");
    const [epNum, setEpNum] = useState(1);
    const [epTitle, setEpTitle] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!id) return;
        getSeries(id)
            .then((s) => { setWork(s); if (!s) setError("作品が見つかりません"); })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleAddEpisode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !epId.trim() || !epTitle.trim()) return;

        setSaving(true);
        setError("");
        try {
            await saveEpisode(id, {
                id: epId,
                episodeNumber: epNum,
                title: epTitle,
                pages: [],
            });
            // Refresh
            const updated = await getSeries(id);
            setWork(updated);
            setShowForm(false);
            setEpId("");
            setEpTitle("");
            setEpNum((work?.episodes.length ?? 0) + 2);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p style={{ color: "var(--muted)" }}>Loading…</p>;
    if (!work) return <div className="error-msg">作品が見つかりません</div>;

    return (
        <div>
            <h1>{work.title}</h1>
            <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>{work.description}</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                <span className="badge">{work.status}</span>{" "}
                ID: {work.id} — {work.episodes.length} episode(s)
            </p>

            <div style={{ display: "flex", gap: "0.75rem", margin: "1.5rem 0" }}>
                <button className="btn btn-outline" onClick={() => setShowForm(!showForm)}>
                    {showForm ? "キャンセル" : "+ エピソードを追加"}
                </button>
                <Link to={`/works/${id}/publish`} className="btn btn-success">
                    📦 Review & Publish
                </Link>
            </div>

            {showForm && (
                <form onSubmit={handleAddEpisode} className="card" style={{ maxWidth: "28rem", marginBottom: "1.5rem" }}>
                    <div className="form-group">
                        <label>Episode ID (slug)</label>
                        <input value={epId} onChange={(e) => setEpId(e.target.value)} placeholder="ep01" />
                    </div>
                    <div className="form-group">
                        <label>Episode Number</label>
                        <input type="number" min={1} value={epNum} onChange={(e) => setEpNum(Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                        <label>タイトル</label>
                        <input value={epTitle} onChange={(e) => setEpTitle(e.target.value)} placeholder="第1話 雨の始まり" />
                    </div>
                    {error && <div className="error-msg">{error}</div>}
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "保存中…" : "エピソードを保存"}
                    </button>
                </form>
            )}

            <h2>Episodes</h2>
            {work.episodes.length === 0 ? (
                <div className="card empty-state">エピソードがまだありません</div>
            ) : (
                <div className="episode-list">
                    {work.episodes.map((ep) => (
                        <Link to={`/works/${id}/episodes/${ep.id}`} key={ep.id} className="card card-link">
                            <div className="card-title">
                                <span className="badge" style={{ marginRight: "0.5rem" }}>EP{ep.episodeNumber}</span>
                                {ep.title}
                            </div>
                            <div className="card-meta">
                                {ep.pageCount} page(s) — {ep.publishedAt}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
