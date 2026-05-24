import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    getJob, updateDraft, submitForReview, confirmJob, cancelJob,
    type IngestionJob, type DraftPayload, type DraftPage,
} from "../api";

export default function JobDetail() {
    const { jobId } = useParams<{ jobId: string }>();
    const nav = useNavigate();
    const [job, setJob] = useState<IngestionJob | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [confirmResult, setConfirmResult] = useState<{ seriesId: string } | null>(null);

    const reload = () => {
        if (!jobId) return;
        getJob(jobId).then((j) => { setJob(j); if (!j) setError("Job not found"); });
    };

    useEffect(() => {
        reload();
        setLoading(false);
    }, [jobId]);

    const draft = job?.draft;

    // --- Draft editing helpers ---
    const updateField = (field: keyof DraftPayload, value: unknown) => {
        if (!draft) return;
        const updated = { ...draft, [field]: value };
        setJob({ ...job!, draft: updated });
    };

    const updatePage = (idx: number, field: keyof DraftPage, value: unknown) => {
        if (!draft) return;
        const pages = [...draft.pages];
        (pages[idx] as any)[field] = value;
        updateField("pages", pages);
    };

    const addPage = () => {
        if (!draft) return;
        const n = draft.pages.length + 1;
        updateField("pages", [
            ...draft.pages,
            { pageNumber: n, imagePath: `pages/p${String(n).padStart(2, "0")}.jpg`, width: 500, height: 760, panels: [] },
        ]);
    };

    const saveDraft = async () => {
        if (!jobId || !draft) return;
        setBusy(true);
        setError("");
        try {
            await updateDraft(jobId, draft);
            reload();
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    const doSubmit = async () => {
        if (!jobId) return;
        await saveDraft();
        setBusy(true);
        try {
            await submitForReview(jobId);
            reload();
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    const doConfirm = async () => {
        if (!jobId) return;
        setBusy(true);
        setError("");
        try {
            const res = await confirmJob(jobId);
            setConfirmResult(res);
            reload();
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    const doCancel = async () => {
        if (!jobId) return;
        setBusy(true);
        try {
            await cancelJob(jobId);
            reload();
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    if (loading) return <p style={{ color: "var(--muted)" }}>Loading…</p>;
    if (!job) return <div className="error-msg">Job not found</div>;

    const isEditable = job.status === "queued" || job.status === "draft";
    const isReviewable = job.status === "waiting_review";

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h1>Job: {job.label}</h1>
                <span className={`badge ${job.status === "confirmed" ? "badge-ok" : job.status === "failed" ? "badge-err" : ""}`}>
                    {job.status}
                </span>
            </div>

            {job.errorMessage && <div className="error-msg">Error: {job.errorMessage}</div>}
            {error && <div className="error-msg">{error}</div>}
            {confirmResult && (
                <div className="success-msg">
                    <p>✅ Confirmed! Written to contents/{confirmResult.seriesId}/</p>
                    <p>
                        <Link to={`/works/${confirmResult.seriesId}`}>View in CMS</Link>
                        {" | "}
                        <a href={`/api/v1/series/${confirmResult.seriesId}`} target="_blank" rel="noreferrer">API</a>
                    </p>
                </div>
            )}

            {/* Draft editor */}
            {draft && isEditable && (
                <div>
                    <div className="card">
                        <h2>Draft — 作品情報</h2>
                        <div className="form-group">
                            <label>Series ID</label>
                            <input value={draft.seriesId} onChange={(e) => updateField("seriesId", e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Series Title</label>
                            <input value={draft.seriesTitle} onChange={(e) => updateField("seriesTitle", e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Episode ID</label>
                            <input value={draft.episodeId} onChange={(e) => updateField("episodeId", e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Episode Title</label>
                            <input value={draft.episodeTitle} onChange={(e) => updateField("episodeTitle", e.target.value)} />
                        </div>
                    </div>

                    <h2>Pages ({draft.pages.length})</h2>
                    {draft.pages.map((p, idx) => (
                        <div key={idx} className="card" style={{ marginBottom: "0.5rem" }}>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <span className="badge">P{p.pageNumber}</span>
                                <input style={{ flex: 1 }} value={p.imagePath} onChange={(e) => updatePage(idx, "imagePath", e.target.value)} />
                                <input style={{ width: "5rem" }} type="number" value={p.width} onChange={(e) => updatePage(idx, "width", Number(e.target.value))} />
                                ×
                                <input style={{ width: "5rem" }} type="number" value={p.height} onChange={(e) => updatePage(idx, "height", Number(e.target.value))} />
                            </div>
                        </div>
                    ))}
                    <button type="button" onClick={addPage} className="btn btn-outline" style={{ marginBottom: "1rem" }}>+ Page</button>

                    <div className="section-actions">
                        <button onClick={saveDraft} className="btn btn-outline" disabled={busy}>💾 Save Draft</button>
                        <button onClick={doSubmit} className="btn btn-primary" disabled={busy}>📤 Submit for Review</button>
                        <button onClick={doCancel} className="btn btn-outline" disabled={busy} style={{ color: "var(--danger)" }}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Review view */}
            {draft && isReviewable && (
                <div>
                    <h2>Review — 確認してください</h2>

                    <h3>series.json になる内容</h3>
                    <div className="json-preview">
                        {JSON.stringify({
                            id: draft.seriesId,
                            title: draft.seriesTitle,
                            description: draft.seriesDescription ?? "",
                            status: draft.seriesStatus ?? "ongoing",
                            episodes: [draft.episodeId],
                        }, null, 2)}
                    </div>

                    <h3>episode.json になる内容</h3>
                    <div className="json-preview">
                        {JSON.stringify({
                            id: draft.episodeId,
                            episodeNumber: draft.episodeNumber,
                            title: draft.episodeTitle,
                            pages: draft.pages.map((p) => ({
                                pageNumber: p.pageNumber,
                                imagePath: p.imagePath,
                                width: p.width,
                                height: p.height,
                                panelCount: p.panels.length,
                            })),
                        }, null, 2)}
                    </div>

                    <div className="section-actions">
                        <button onClick={doConfirm} className="btn btn-success" disabled={busy}>
                            ✅ Confirm — contents/ に書き込む
                        </button>
                        <button onClick={doCancel} className="btn btn-outline" disabled={busy} style={{ color: "var(--danger)" }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Read-only view for confirmed/failed/canceled */}
            {draft && !isEditable && !isReviewable && (
                <div>
                    <h2>Draft (read-only)</h2>
                    <div className="json-preview">{JSON.stringify(draft, null, 2)}</div>
                </div>
            )}

            <div style={{ marginTop: "2rem" }}>
                <Link to="/ingestion" className="btn btn-outline">← Jobs 一覧</Link>
            </div>
        </div>
    );
}
