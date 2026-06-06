import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    createFeedbackGitHubHandoff,
    createProposalFromFeedback,
    getAdminEpisode,
    getFeedback,
    listProposals,
    updateFeedbackStatus,
    type EpisodeData,
    type FeedbackRecord,
    type FeedbackStatus,
    type ProposalRecord,
} from "../api";
import {
    feedbackIdentityLabel,
    feedbackTargetKind,
    feedbackTargetLabel,
    findProposalForFeedback,
    formatFeedbackDate,
    resolveFeedbackTarget,
    sourceTextMatchesFeedback,
    type FeedbackTargetContext,
} from "../lib/feedbackTriage";

const STATUS_CLASS: Record<FeedbackStatus, string> = {
    new: "badge-warn",
    triaged: "",
    closed: "badge-muted",
};

function textOrDash(value: string | null | undefined) {
    return value?.trim() ? value : "-";
}

function bboxSummary(box: { x: number; y: number; width: number; height: number } | undefined) {
    if (!box) return "-";
    return `x:${Math.round(box.x)}, y:${Math.round(box.y)}, w:${Math.round(box.width)}, h:${Math.round(box.height)}`;
}

function TextBlock({ label, value, emphasis }: { label: string; value?: string; emphasis?: boolean }) {
    return (
        <div className={`feedback-text-block ${emphasis ? "is-emphasis" : ""}`}>
            <span>{label}</span>
            <p>{textOrDash(value)}</p>
        </div>
    );
}

export default function FeedbackDetail() {
    const { feedbackId } = useParams<{ feedbackId: string }>();
    const navigate = useNavigate();
    const [record, setRecord] = useState<FeedbackRecord | null>(null);
    const [episode, setEpisode] = useState<EpisodeData | null>(null);
    const [proposals, setProposals] = useState<ProposalRecord[]>([]);
    const [status, setStatus] = useState<FeedbackStatus>("new");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [creatingProposal, setCreatingProposal] = useState(false);
    const [creatingHandoff, setCreatingHandoff] = useState(false);
    const [handoffId, setHandoffId] = useState("");
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!feedbackId) return;
        setLoading(true);
        setError("");
        getFeedback(feedbackId)
            .then(async (next) => {
                setRecord(next);
                if (!next) {
                    setError("Feedback not found");
                    return;
                }
                setStatus(next.status);
                setNote(next.triage_note ?? "");
                const [nextEpisode, nextProposals] = await Promise.all([
                    getAdminEpisode(next.series_id, next.episode_id).catch(() => null),
                    listProposals({ seriesId: next.series_id }).catch(() => []),
                ]);
                setEpisode(nextEpisode);
                setProposals(nextProposals);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [feedbackId]);

    const targetContext = useMemo<FeedbackTargetContext>(() => (
        record ? resolveFeedbackTarget(record, episode) : { kind: "episode" }
    ), [episode, record]);
    const sourceTextMatch = record ? sourceTextMatchesFeedback(record, targetContext) : null;
    const existingProposal = feedbackId ? findProposalForFeedback(feedbackId, proposals) : null;
    const canCreateProposal = record?.status === "new" && !existingProposal;

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

    const createProposal = async () => {
        if (!feedbackId) return;
        setCreatingProposal(true);
        setError("");
        try {
            const proposal = await createProposalFromFeedback(feedbackId);
            navigate(`/proposals/${proposal.proposal_id}`);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setCreatingProposal(false);
        }
    };

    const createGitHubHandoff = async () => {
        if (!feedbackId) return;
        setCreatingHandoff(true);
        setError("");
        setHandoffId("");
        try {
            const handoff = await createFeedbackGitHubHandoff(feedbackId, {
                mode: "triage_issue_comment",
                triage_group_key: `${record?.series_id ?? "series"}/${record?.episode_id ?? "episode"}`,
                title: `${record?.issue_type ?? "feedback"} · ${record?.series_id ?? ""} / ${record?.episode_id ?? ""}`.trim(),
            });
            setHandoffId(handoff.handoff_id);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setCreatingHandoff(false);
        }
    };

    if (loading) return <p style={{ color: "var(--muted)" }}>Loading...</p>;
    if (!record) return <div className="error-msg">{error || "Feedback not found"}</div>;

    return (
        <div className="feedback-detail-page">
            <div className="section-heading">
                <div>
                    <h1>Feedback Detail</h1>
                    <p className="card-meta">{record.feedback_id}</p>
                </div>
                <div className="section-actions">
                    <span className={`badge ${STATUS_CLASS[record.status]}`}>{record.status}</span>
                    <span className="badge">{record.issue_type}</span>
                    <span className="badge badge-muted">{feedbackTargetKind(record)}</span>
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {saved && <div className="success-msg">Feedback updated.</div>}
            {handoffId && (
                <div className="success-msg">
                    GitHub handoff queued. <Link to="/github-handoffs">Open handoff queue</Link>
                </div>
            )}
            {existingProposal && (
                <div className="success-msg">
                    Proposal created: <Link to={`/proposals/${existingProposal.proposal_id}`}>{existingProposal.proposal_id}</Link>
                </div>
            )}
            {!canCreateProposal && !existingProposal && (
                <div className="success-msg">
                    This feedback has already left the new queue. Proposal creation is only available for new feedback.
                </div>
            )}

            <div className="feedback-detail-grid">
                <section className="card">
                    <h2>Reader Comment</h2>
                    <div className="feedback-badge-row">
                        <span className="badge">{record.mode}</span>
                        <span className="badge badge-muted">{record.lang ?? "lang -"}</span>
                        <span className="badge badge-muted">{feedbackIdentityLabel(record)}</span>
                    </div>
                    <TextBlock label="comment" value={record.comment} emphasis />
                    <div className="feedback-text-grid">
                        <TextBlock label="current_text" value={record.current_text} />
                        <TextBlock label="current_translation" value={record.current_translation} />
                        <TextBlock label="suggested_text" value={record.suggested_text} />
                    </div>
                </section>

                <section className="card">
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
                        {saving ? "保存中..." : "Status を保存"}
                    </button>
                </section>
            </div>

            <section className="card">
                <h2>Target Context</h2>
                <dl className="detail-list">
                    <dt>Series</dt><dd>{record.series_id}</dd>
                    <dt>Episode</dt><dd>{record.episode_id}</dd>
                    <dt>Target</dt><dd>{feedbackTargetLabel(record)}</dd>
                    <dt>Created</dt><dd>{formatFeedbackDate(record.created_at)}</dd>
                    <dt>Page</dt><dd>{targetContext.page ? `${targetContext.page.displayRef ?? targetContext.page.pageId ?? targetContext.page.id} / Page ${targetContext.page.pageNumber}` : record.page_id ?? "-"}</dd>
                    <dt>Panel</dt><dd>{targetContext.panel ? `${targetContext.panel.displayRef ?? targetContext.panel.panelId ?? targetContext.panel.id} / Panel ${targetContext.panel.panelNumber}` : record.panel_id ?? "-"}</dd>
                    <dt>Bubble</dt><dd>{targetContext.bubble ? `${targetContext.bubble.displayRef ?? targetContext.bubble.shortId ?? targetContext.bubble.bubbleId ?? targetContext.bubble.id} / reading ${targetContext.bubble.bubbleNumber}` : record.bubble_id ?? "-"}</dd>
                    <dt>BBox</dt><dd>{bboxSummary(targetContext.bubble?.bbox ?? targetContext.panel?.bbox)}</dd>
                </dl>
                {targetContext.bubble ? (
                    <div className={`feedback-source-compare ${sourceTextMatch === false ? "is-mismatch" : ""}`}>
                        <div>
                            <span>canonical Bubble.textOriginal</span>
                            <p>{textOrDash(targetContext.bubble.textOriginal)}</p>
                        </div>
                        <div>
                            <span>feedback.current_text</span>
                            <p>{textOrDash(record.current_text)}</p>
                        </div>
                        <span className={`badge ${sourceTextMatch ? "badge-ok" : "badge-warn"}`}>
                            {sourceTextMatch ? "text matches" : "text differs"}
                        </span>
                    </div>
                ) : (
                    <p className="card-meta">Bubble target ではないため、canonical Bubble.textOriginal 比較は表示しません。</p>
                )}
            </section>

            <section className="card">
                <h2>Actions</h2>
                <div className="section-actions">
                    <Link to="/feedback" className="btn btn-outline">Feedback 一覧</Link>
                    <Link to={`/works/${record.series_id}/episodes/${record.episode_id}`} className="btn btn-outline">Episode Editor</Link>
                    <Link to={`/works/${record.series_id}/episodes/${record.episode_id}/structure`} className="btn btn-outline">Structure Review</Link>
                    {existingProposal && <Link to={`/proposals/${existingProposal.proposal_id}`} className="btn btn-outline">Proposal Detail</Link>}
                    {canCreateProposal && (
                        <button type="button" className="btn btn-primary" disabled={creatingProposal} onClick={createProposal}>
                            {creatingProposal ? "Creating..." : "Create Proposal"}
                        </button>
                    )}
                    <button type="button" className="btn btn-outline" disabled={creatingHandoff} onClick={createGitHubHandoff}>
                        {creatingHandoff ? "Queueing..." : "Queue GitHub Handoff"}
                    </button>
                    {record.source_url && <a href={record.source_url} target="_blank" rel="noreferrer" className="btn btn-outline">Source URL</a>}
                </div>
            </section>

            <details className="card feedback-debug-card">
                <summary>Debug / request metadata</summary>
                <dl className="detail-list">
                    <dt>client_time</dt><dd>{record.client_time ?? "-"}</dd>
                    <dt>user_id</dt><dd>{record.user_id ?? "-"}</dd>
                    <dt>client_ip</dt><dd>{record.client_ip ?? "-"}</dd>
                    <dt>User-Agent</dt><dd>{record.user_agent ?? "-"}</dd>
                    <dt>source_url</dt><dd>{record.source_url}</dd>
                    <dt>triaged_by</dt><dd>{record.triaged_by ?? "-"}</dd>
                    <dt>triaged_at</dt><dd>{record.triaged_at ?? "-"}</dd>
                </dl>
            </details>
        </div>
    );
}
