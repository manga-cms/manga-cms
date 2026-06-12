import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
    getJob, updateDraft, submitForReview, confirmJob, cancelJob,
    getReviewCandidates, setReviewDecision, writeReviewedDraft,
    type IngestionJob, type DraftPayload, type DraftPage, type IngestionReviewCandidate,
    type IngestionReviewDecisionValue,
} from "../api";

export default function JobDetail() {
    const { jobId } = useParams<{ jobId: string }>();
    const [job, setJob] = useState<IngestionJob | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [confirmResult, setConfirmResult] = useState<{ seriesId: string } | null>(null);
    const [candidates, setCandidates] = useState<IngestionReviewCandidate[]>([]);

    const reload = async () => {
        if (!jobId) return;
        const j = await getJob(jobId);
        setJob(j);
        if (!j) {
            setError("Job not found");
            setCandidates([]);
            return;
        }
        if (j.draft) {
            try {
                setCandidates(await getReviewCandidates(jobId));
            } catch {
                setCandidates([]);
            }
        }
    };

    useEffect(() => {
        reload().finally(() => setLoading(false));
    }, [jobId]);

    const draft = job?.draft;
    const canOpenStructureReview = job?.status === "confirmed" || confirmResult !== null;
    const structureReviewPath = draft && jobId && canOpenStructureReview
        ? `/works/${draft.seriesId}/episodes/${draft.episodeId}/structure?jobId=${encodeURIComponent(jobId)}`
        : "";

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

    const markCandidate = async (candidate: IngestionReviewCandidate, decision: IngestionReviewDecisionValue) => {
        if (!jobId) return;
        setBusy(true);
        setError("");
        try {
            setCandidates(await setReviewDecision(jobId, candidate.target, decision));
            await reload();
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };

    const doWriteReviewedDraft = async () => {
        if (!jobId) return;
        setBusy(true);
        setError("");
        try {
            const nextDraft = await writeReviewedDraft(jobId);
            setJob((current) => current ? { ...current, draft: nextDraft } : current);
            await reload();
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
    const candidateSummary = candidates.reduce((acc, candidate) => {
        acc[candidate.decision] += 1;
        return acc;
    }, { pending: 0, accepted: 0, rejected: 0 } as Record<IngestionReviewDecisionValue, number>);

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
                        {structureReviewPath && (
                            <>
                                {" | "}
                                <Link to={structureReviewPath}>Page Structure Review で確認</Link>
                            </>
                        )}
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
                    <div className="card">
                        <h3>Structure Candidates</h3>
                        <div className="review-summary">
                            <span className="badge badge-warn">Pending {candidateSummary.pending}</span>
                            <span className="badge badge-ok">Accepted {candidateSummary.accepted}</span>
                            <span className="badge">Rejected {candidateSummary.rejected}</span>
                        </div>
                        {candidates.length === 0 ? (
                            <p className="card-meta">No Page / Panel / Bubble candidates found in this draft.</p>
                        ) : (
                            <div style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
                                {candidates.map((candidate) => (
                                    <div key={candidate.key} className="candidate-row">
                                        <div>
                                            <strong>
                                                {candidate.target.kind === "panel"
                                                    ? `P${candidate.target.pageNumber} Panel ${candidate.target.panelNumber}`
                                                    : `P${candidate.target.pageNumber} Panel ${candidate.target.panelNumber} Bubble ${candidate.target.bubbleNumber}`}
                                            </strong>
                                            <p className="card-meta">
                                                {candidate.bubble?.textOriginal || candidate.panel?.reactionTags.join(", ") || candidate.key}
                                            </p>
                                        </div>
                                        <span className={`badge ${candidate.decision === "accepted" ? "badge-ok" : candidate.decision === "pending" ? "badge-warn" : ""}`}>
                                            {candidate.decision}
                                        </span>
                                        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => markCandidate(candidate, "accepted")}>Accept</button>
                                        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => markCandidate(candidate, "rejected")}>Reject</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="section-actions" style={{ marginTop: "1rem" }}>
                            {structureReviewPath && (
                                <Link to={structureReviewPath} className="btn btn-outline">
                                    Page Structure Review で確認
                                </Link>
                            )}
                            <button type="button" className="btn btn-outline" disabled={busy || candidateSummary.pending > 0} onClick={doWriteReviewedDraft}>
                                Write accepted structure to draft
                            </button>
                        </div>
                    </div>

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
                    {structureReviewPath && (
                        <div className="section-actions">
                            <Link to={structureReviewPath} className="btn btn-outline">
                                Page Structure Review で確認
                            </Link>
                        </div>
                    )}
                    <div className="json-preview">{JSON.stringify(draft, null, 2)}</div>
                </div>
            )}

            <div style={{ marginTop: "2rem" }}>
                <Link to="/ingestion" className="btn btn-outline">← Jobs 一覧</Link>
            </div>
        </div>
    );
}
