import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    adoptProposalIntoPackDraft,
    getProposal,
    listPackDrafts,
    updateProposalStatus,
    type PackDraftRecord,
    type PackType,
    type ProposalKind,
    type ProposalRecord,
    type ProposalStatus,
} from "../api";

const PROPOSAL_COMPATIBILITY: Record<ProposalKind, PackType[]> = {
    translation: ["TRANSLATION"],
    typo: ["TRANSLATION"],
    footnote: ["FOOTNOTE"],
    commentary: ["COMMENTARY", "LEARNING"],
    tag: ["COMMENTARY", "LEARNING"],
    structure: ["ACCESSIBILITY"],
};

function canAdoptIntoDraft(proposal: ProposalRecord, draft: PackDraftRecord) {
    if (proposal.status !== "accepted") return false;
    if (!["draft", "in_review"].includes(draft.status)) return false;
    if (!PROPOSAL_COMPATIBILITY[proposal.kind].includes(draft.type)) return false;
    if (draft.target_series_id && draft.target_series_id !== proposal.series_id) return false;
    if (draft.target_episode_id && draft.target_episode_id !== proposal.episode_id) return false;
    if (draft.entries.some((entry) => entry.source_proposal_id === proposal.proposal_id)) return false;
    return true;
}

export default function ProposalDetail() {
    const { proposalId } = useParams<{ proposalId: string }>();
    const [record, setRecord] = useState<ProposalRecord | null>(null);
    const [packDrafts, setPackDrafts] = useState<PackDraftRecord[]>([]);
    const [status, setStatus] = useState<ProposalStatus>("new");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [adoptingId, setAdoptingId] = useState("");
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [adoptedDraftId, setAdoptedDraftId] = useState("");

    useEffect(() => {
        if (!proposalId) return;
        Promise.all([
            getProposal(proposalId),
            listPackDrafts({}),
        ])
            .then(([next, drafts]) => {
                setRecord(next);
                setPackDrafts(drafts);
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
            if (next.status === "accepted") {
                setPackDrafts(await listPackDrafts({}));
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const adoptIntoDraft = async (packDraftId: string) => {
        if (!proposalId) return;
        setAdoptingId(packDraftId);
        setError("");
        setSaved(false);
        setAdoptedDraftId("");
        try {
            const nextDraft = await adoptProposalIntoPackDraft(packDraftId, proposalId);
            setPackDrafts((current) => current.map((draft) => draft.pack_draft_id === nextDraft.pack_draft_id ? nextDraft : draft));
            setAdoptedDraftId(nextDraft.pack_draft_id);
            setSaved(true);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setAdoptingId("");
        }
    };

    if (loading) return <p style={{ color: "var(--muted)" }}>Loading...</p>;
    if (!record) return <div className="error-msg">{error || "Proposal not found"}</div>;
    const adoptedDrafts = packDrafts.filter((draft) =>
        draft.entries.some((entry) => entry.source_proposal_id === record.proposal_id),
    );
    const compatibleDrafts = packDrafts.filter((draft) => canAdoptIntoDraft(record, draft));
    const compatibleTypes = PROPOSAL_COMPATIBILITY[record.kind].join(", ");

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
            {adoptedDraftId && (
                <div className="success-msg">
                    Proposal adopted into Pack Draft <Link to={`/pack-drafts/${adoptedDraftId}`}>{adoptedDraftId}</Link>.
                </div>
            )}
            {status === "accepted" && (
                <div className="success-msg">
                    Accepted records are not applied to canonical content or published packs automatically. Adopt this proposal into a Pack Draft as a separate step.
                </div>
            )}
            {adoptedDrafts.length > 0 && (
                <div className="success-msg">
                    Already adopted into {adoptedDrafts.length} Pack Draft{adoptedDrafts.length === 1 ? "" : "s"}:{" "}
                    {adoptedDrafts.map((draft, index) => (
                        <span key={draft.pack_draft_id}>
                            {index > 0 && ", "}
                            <Link to={`/pack-drafts/${draft.pack_draft_id}`}>{draft.title}</Link>
                        </span>
                    ))}
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

            {record.status === "accepted" && (
                <div className="card">
                    <h2>Adopt Into Pack Draft</h2>
                    <p className="card-meta">
                        Compatible Pack types: {compatibleTypes}. Only draft or in_review Pack Drafts with matching Series/Episode scope are shown.
                        Drafts that already include this proposal are listed above instead of being offered again.
                    </p>
                    {compatibleDrafts.length === 0 ? (
                        <div className="empty-state">
                            No compatible Pack Drafts are ready. Create one from Pack Drafts, then return to this proposal.
                        </div>
                    ) : (
                        <div className="compact-list">
                            {compatibleDrafts.map((draft) => (
                                <div key={draft.pack_draft_id} className="compact-list-item">
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                                        <div>
                                            <div className="card-title">{draft.title}</div>
                                            <div className="card-meta">
                                                {draft.type} · {draft.language ?? "-"} · {draft.status} · {draft.entries.length} entries
                                            </div>
                                            <div className="card-meta">
                                                {draft.target_series_id ?? "all series"} / {draft.target_episode_id ?? "all episodes"}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-primary btn-compact"
                                            disabled={adoptingId === draft.pack_draft_id}
                                            onClick={() => adoptIntoDraft(draft.pack_draft_id)}
                                        >
                                            {adoptingId === draft.pack_draft_id ? "Adopting..." : "Adopt"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="section-actions" style={{ marginTop: "1rem" }}>
                        <Link to="/pack-drafts" className="btn btn-outline">Open Pack Drafts</Link>
                    </div>
                </div>
            )}

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
