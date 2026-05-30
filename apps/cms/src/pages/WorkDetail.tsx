import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { getAdminEpisode, getSeries, saveEpisode, updateSeries, type PublicationVisibility, type SeriesDetail } from "../api";
import {
    formatPublicationDate,
    getPublicationState,
    publicationInputPayload,
    toLocalDateTimeInput,
    type PublicationFormState,
} from "../publication";

export default function WorkDetail() {
    const { id } = useParams<{ id: string }>();
    const nav = useNavigate();
    const [work, setWork] = useState<SeriesDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [scheduleSaved, setScheduleSaved] = useState(false);
    const [bulkSaved, setBulkSaved] = useState(false);
    const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<string[]>([]);
    const [seriesSchedule, setSeriesSchedule] = useState<PublicationFormState>({
        visibility: "public",
        publishStartAt: "",
        publishEndAt: "",
    });
    const [episodeBulkSchedule, setEpisodeBulkSchedule] = useState<PublicationFormState>({
        visibility: "public",
        publishStartAt: "",
        publishEndAt: "",
    });

    // Add episode form
    const [showForm, setShowForm] = useState(false);
    const [epId, setEpId] = useState("");
    const [epNum, setEpNum] = useState(1);
    const [epTitle, setEpTitle] = useState("");
    const [saving, setSaving] = useState(false);

    const applyWork = (next: SeriesDetail | null) => {
        setWork(next);
        if (!next) return;
        setSeriesSchedule({
            visibility: next.visibility ?? "public",
            publishStartAt: toLocalDateTimeInput(next.publishStartAt),
            publishEndAt: toLocalDateTimeInput(next.publishEndAt),
        });
    };

    useEffect(() => {
        if (!id) return;
        getSeries(id)
            .then((s) => { applyWork(s); if (!s) setError("作品が見つかりません"); })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleSeriesScheduleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        setSaving(true);
        setError("");
        setScheduleSaved(false);
        try {
            await updateSeries(id, publicationInputPayload(seriesSchedule));
            const updated = await getSeries(id);
            applyWork(updated);
            setScheduleSaved(true);
            setBulkSaved(false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const toggleEpisodeSelection = (episodeId: string) => {
        setSelectedEpisodeIds((current) =>
            current.includes(episodeId)
                ? current.filter((id) => id !== episodeId)
                : [...current, episodeId],
        );
    };

    const handleBulkEpisodeScheduleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || selectedEpisodeIds.length === 0) return;
        setSaving(true);
        setError("");
        setScheduleSaved(false);
        setBulkSaved(false);
        try {
            const payload = publicationInputPayload(episodeBulkSchedule);
            for (const episodeId of selectedEpisodeIds) {
                const episode = await getAdminEpisode(id, episodeId);
                if (!episode) throw new Error(`Episode not found: ${episodeId}`);
                await saveEpisode(id, {
                    id: episode.id,
                    episodeNumber: episode.episodeNumber,
                    title: episode.title,
                    publishedAt: episode.publishedAt,
                    ...payload,
                    pages: episode.pages,
                });
            }
            const updated = await getSeries(id);
            applyWork(updated);
            setSelectedEpisodeIds([]);
            setBulkSaved(true);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

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
            applyWork(updated);
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
    const seriesPublicationState = getPublicationState(work);

    return (
        <div>
            <h1>{work.title}</h1>
            <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>{work.description}</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                <span className="badge">{work.status}</span>{" "}
                <span className={`badge publication-${seriesPublicationState}`}>{seriesPublicationState}</span>{" "}
                ID: {work.id} — {work.episodes.length} episode(s)
            </p>

            <form onSubmit={handleSeriesScheduleSave} className="card publication-card">
                <div className="section-heading">
                    <div>
                        <h2>Publication</h2>
                        <p className="card-meta">Series visibility controls whether the public Reader can discover or open any Episode in this Series.</p>
                    </div>
                    <span className={`badge publication-${seriesPublicationState}`}>{seriesPublicationState}</span>
                </div>
                <div className="publication-grid">
                    <div className="form-group">
                        <label>Visibility</label>
                        <select
                            value={seriesSchedule.visibility}
                            onChange={(e) => setSeriesSchedule((current) => ({ ...current, visibility: e.target.value as PublicationVisibility }))}
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
                            value={seriesSchedule.publishStartAt}
                            onChange={(e) => setSeriesSchedule((current) => ({ ...current, publishStartAt: e.target.value }))}
                        />
                    </div>
                    <div className="form-group">
                        <label>Publish End</label>
                        <input
                            type="datetime-local"
                            value={seriesSchedule.publishEndAt}
                            onChange={(e) => setSeriesSchedule((current) => ({ ...current, publishEndAt: e.target.value }))}
                        />
                    </div>
                </div>
                <div className="publication-summary">
                    <span>Start: {formatPublicationDate(work.publishStartAt)}</span>
                    <span>End: {formatPublicationDate(work.publishEndAt)}</span>
                </div>
                {scheduleSaved && <div className="success-msg">Publication settings saved.</div>}
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "保存中…" : "公開設定を保存"}
                </button>
            </form>

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
            {work.episodes.length > 0 && (
                <form onSubmit={handleBulkEpisodeScheduleSave} className="card publication-card">
                    <div className="section-heading">
                        <div>
                            <h3>Bulk Episode Publication</h3>
                            <p className="card-meta">Apply visibility and scheduling fields to selected Episodes. Page, Panel, and Bubble data is preserved.</p>
                        </div>
                        <span className="badge">{selectedEpisodeIds.length} selected</span>
                    </div>
                    <div className="publication-grid">
                        <div className="form-group">
                            <label>Visibility</label>
                            <select
                                value={episodeBulkSchedule.visibility}
                                onChange={(e) => setEpisodeBulkSchedule((current) => ({ ...current, visibility: e.target.value as PublicationVisibility }))}
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
                                value={episodeBulkSchedule.publishStartAt}
                                onChange={(e) => setEpisodeBulkSchedule((current) => ({ ...current, publishStartAt: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Publish End</label>
                            <input
                                type="datetime-local"
                                value={episodeBulkSchedule.publishEndAt}
                                onChange={(e) => setEpisodeBulkSchedule((current) => ({ ...current, publishEndAt: e.target.value }))}
                            />
                        </div>
                    </div>
                    {bulkSaved && <div className="success-msg">Episode publication settings saved.</div>}
                    <div className="section-actions" style={{ marginTop: "1rem" }}>
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => setSelectedEpisodeIds(work.episodes.map((ep) => ep.id))}
                            disabled={saving}
                        >
                            Select all
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => setSelectedEpisodeIds([])}
                            disabled={saving || selectedEpisodeIds.length === 0}
                        >
                            Clear
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving || selectedEpisodeIds.length === 0}>
                            {saving ? "保存中…" : "選択したEpisodeに適用"}
                        </button>
                    </div>
                </form>
            )}
            {work.episodes.length === 0 ? (
                <div className="card empty-state">エピソードがまだありません</div>
            ) : (
                <div className="episode-list">
                    {work.episodes.map((ep) => (
                        <div key={ep.id} className="card">
                            <div className="card-title">
                                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", marginRight: "0.5rem" }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedEpisodeIds.includes(ep.id)}
                                        onChange={() => toggleEpisodeSelection(ep.id)}
                                        aria-label={`Select ${ep.title}`}
                                    />
                                </label>
                                <span className="badge" style={{ marginRight: "0.5rem" }}>EP{ep.episodeNumber}</span>
                                <span className={`badge publication-${getPublicationState(ep)}`} style={{ marginRight: "0.5rem" }}>
                                    {getPublicationState(ep)}
                                </span>
                                {ep.title}
                            </div>
                            <div className="card-meta">
                                {ep.pageCount} page(s) — {ep.publishedAt}
                                {ep.publishStartAt && <> — starts {formatPublicationDate(ep.publishStartAt)}</>}
                                {ep.publishEndAt && <> — ends {formatPublicationDate(ep.publishEndAt)}</>}
                            </div>
                            <div className="section-actions">
                                <Link to={`/works/${id}/episodes/${ep.id}`} className="btn btn-outline">Episode</Link>
                                <Link to={`/works/${id}/episodes/${ep.id}/structure`} className="btn btn-primary">Structure Review</Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
