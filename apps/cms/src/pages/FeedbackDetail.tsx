import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    getFeedback,
    updateFeedbackStatus,
    type FeedbackRecord,
    type FeedbackStatus,
} from "../api";

export default function FeedbackDetail() {
    const { feedbackId } = useParams<{ feedbackId: string }>();
    const [record, setRecord] = useState<FeedbackRecord | null>(null);
    const [status, setStatus] = useState<FeedbackStatus>("new");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!feedbackId) return;
        getFeedback(feedbackId)
            .then((next) => {
                setRecord(next);
                if (next) {
                    setStatus(next.status);
                    setNote(next.triage_note ?? "");
                } else {
                    setError("Feedback not found");
                }
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [feedbackId]);

    const save = async () => {
        if (!feedbackId) return;
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            const next = await updateFeedbackStatus(feedbackId, status, note);
            setRecord(next);
            setSaved(true);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p style={{ color: "var(--muted)" }}>Loading…</p>;
    if (!record) return <div className="error-msg">{error || "Feedback not found"}</div>;

    return (
        <div>
            <div className="section-heading">
                <div>
                    <h1>Feedback Detail</h1>
                    <p className="card-meta">{record.feedback_id}</p>
                </div>
                <span className="badge">{record.status}</span>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {saved && <div className="success-msg">Feedback updated.</div>}

            <div className="grid-2">
                <div className="card">
                    <h2>Target</h2>
                    <dl className="detail-list">
                        <dt>Series</dt><dd>{record.series_id}</dd>
                        <dt>Episode</dt><dd>{record.episode_id}</dd>
                        <dt>Page</dt><dd>{record.page_id ?? "-"}</dd>
                        <dt>Panel</dt><dd>{record.panel_id ?? "-"}</dd>
                        <dt>Bubble</dt><dd>{record.bubble_id ?? "-"}</dd>
                        <dt>Mode</dt><dd>{record.mode}</dd>
                        <dt>Issue</dt><dd>{record.issue_type}</dd>
                        <dt>Created</dt><dd>{new Date(record.created_at).toLocaleString("ja-JP")}</dd>
                    </dl>
                </div>

                <div className="card">
                    <h2>Triage</h2>
                    <div className="form-group">
                        <label>Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)}>
                            <option value="new">New</option>
                            <option value="triaged">Triaged</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Note</label>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="対応方針や確認メモ" />
                    </div>
                    <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
                        {saving ? "保存中…" : "Status を保存"}
                    </button>
                </div>
            </div>

            <div className="card">
                <h2>Reader Comment</h2>
                <div className="json-preview">
                    {JSON.stringify({
                        comment: record.comment,
                        current_text: record.current_text,
                        current_translation: record.current_translation,
                        suggested_text: record.suggested_text,
                        lang: record.lang,
                        source_url: record.source_url,
                        user_id: record.user_id,
                        client_time: record.client_time,
                        user_agent: record.user_agent,
                    }, null, 2)}
                </div>
            </div>

            <div className="section-actions">
                <Link to="/feedback" className="btn btn-outline">← Feedback</Link>
                <Link to={`/works/${record.series_id}/episodes/${record.episode_id}`} className="btn btn-outline">Episode</Link>
                {record.source_url && <a href={record.source_url} target="_blank" rel="noreferrer" className="btn btn-outline">Source URL</a>}
            </div>
        </div>
    );
}
