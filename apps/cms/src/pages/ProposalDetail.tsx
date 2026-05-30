import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    getProposal,
    updateProposalStatus,
    type ProposalRecord,
    type ProposalStatus,
} from "../api";

export default function ProposalDetail() {
    const { proposalId } = useParams<{ proposalId: string }>();
    const [record, setRecord] = useState<ProposalRecord | null>(null);
    const [status, setStatus] = useState<ProposalStatus>("new");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!proposalId) return;
        getProposal(proposalId)
            .then((next) => {
                setRecord(next);
                if (next) {
                    setStatus(next.status);
                    setNote(next.review_note ?? "");
                } else {
                    setError("Proposal not found");
                }
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [proposalId]);

    const save = async () => {
        if (!proposalId) return;
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            const next = await updateProposalStatus(proposalId, status, note);
            setRecord(next);
            setSaved(true);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p style={{ color: "var(--muted)" }}>Loading...</p>;
    if (!record) return <div className="error-msg">{error || "Proposal not found"}</div>;

    return (
        <div>
            <div className="section-heading">
                <div>
                    <h1>Proposal Detail</h1>
                    <p className="card-meta">{record.proposal_id}</p>
                </div>
                <span className="badge">{record.status}</span>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {saved && <div className="success-msg">Proposal updated.</div>}
            {status === "accepted" && (
                <div className="success-msg">
                    Accepted records are not applied to canonical content or published packs automatically. Adopt this proposal into a Pack Draft as a separate step.
                </div>
            )}

            <div className="grid-2">
                <div className="card">
                    <h2>Target</h2>
                    <dl className="detail-list">
                        <dt>Kind</dt><dd>{record.kind}</dd>
                        <dt>Series</dt><dd>{record.series_id}</dd>
                        <dt>Episode</dt><dd>{record.episode_id}</dd>
                        <dt>Page</dt><dd>{record.page_id ?? "-"}</dd>
                        <dt>Panel</dt><dd>{record.panel_id ?? "-"}</dd>
                        <dt>Bubble</dt><dd>{record.bubble_id ?? "-"}</dd>
                        <dt>Language</dt><dd>{record.lang ?? "-"}</dd>
                        <dt>Created</dt><dd>{new Date(record.created_at).toLocaleString("ja-JP")}</dd>
                        <dt>Feedback</dt><dd>{record.source_feedback_id ?? "-"}</dd>
                    </dl>
                </div>

                <div className="card">
                    <h2>Review</h2>
                    <div className="form-group">
                        <label>Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value as ProposalStatus)}>
                            <option value="new">New</option>
                            <option value="triaged">Triaged</option>
                            <option value="accepted">Accepted</option>
                            <option value="rejected">Rejected</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Review note</label>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="採用可否、Pack反映方針、追加確認メモ" />
                    </div>
                    <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
                        {saving ? "Saving..." : "Save status"}
                    </button>
                </div>
            </div>

            <div className="card">
                <h2>Proposal Content</h2>
                <div className="json-preview">
                    {JSON.stringify({
                        current_text: record.current_text,
                        current_translation: record.current_translation,
                        suggested_text: record.suggested_text,
                        comment: record.comment,
                        proposer_id: record.proposer_id,
                        source_url: record.source_url,
                        reviewed_by: record.reviewed_by,
                        reviewed_at: record.reviewed_at,
                    }, null, 2)}
                </div>
            </div>

            <div className="section-actions">
                <Link to="/proposals" className="btn btn-outline">Back to proposals</Link>
                <Link to={`/works/${record.series_id}/episodes/${record.episode_id}`} className="btn btn-outline">Episode</Link>
                {record.source_feedback_id && <Link to={`/feedback/${record.source_feedback_id}`} className="btn btn-outline">Feedback</Link>}
                {record.source_url && <a href={record.source_url} target="_blank" rel="noreferrer" className="btn btn-outline">Source URL</a>}
            </div>
        </div>
    );
}
