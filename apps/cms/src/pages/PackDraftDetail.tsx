import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    adoptProposalIntoPackDraft,
    exportPackDraft,
    getPackDraft,
    listProposals,
    updatePackDraftStatus,
    type PackClass,
    type PackDraftRecord,
    type PackDraftStatus,
    type PackType,
    type ProposalKind,
    type ProposalRecord,
} from "../api";
import { translationOriginBadgeClass, translationOriginLabel, translationOriginOfEntry } from "../lib/translationOrigin";

const PACK_STATUSES: PackDraftStatus[] = ["draft", "in_review", "approved", "published", "archived"];

const PROPOSAL_COMPATIBILITY: Record<ProposalKind, PackType[]> = {
    translation: ["TRANSLATION"],
    typo: ["TRANSLATION"],
    footnote: ["FOOTNOTE"],
    commentary: ["COMMENTARY", "LEARNING"],
    tag: ["COMMENTARY", "LEARNING"],
    structure: ["ACCESSIBILITY"],
};

function canAdopt(proposal: ProposalRecord, draft: PackDraftRecord) {
    if (proposal.status !== "accepted") return false;
    if (draft.entries.some((entry) => entry.source_proposal_id === proposal.proposal_id)) return false;
    return PROPOSAL_COMPATIBILITY[proposal.kind].includes(draft.type);
}

export default function PackDraftDetail() {
    const { packDraftId } = useParams<{ packDraftId: string }>();
    const [draft, setDraft] = useState<PackDraftRecord | null>(null);
    const [proposals, setProposals] = useState<ProposalRecord[]>([]);
    const [status, setStatus] = useState<PackDraftStatus>("draft");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [adoptingId, setAdoptingId] = useState("");
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const [exportedPath, setExportedPath] = useState("");
    const [exportForm, setExportForm] = useState({
        pack_id: "",
        pack_class: "draft" as PackClass,
        title: "",
        author_label: "community",
        is_published: false,
        overwrite: false,
    });

    const load = async () => {
        if (!packDraftId) return;
        setLoading(true);
        setError("");
        try {
            const [nextDraft, acceptedProposals] = await Promise.all([
                getPackDraft(packDraftId),
                listProposals({ status: "accepted" }),
            ]);
            setDraft(nextDraft);
            if (nextDraft) setStatus(nextDraft.status);
            setProposals(acceptedProposals);
            if (!nextDraft) setError("Pack draft not found");
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [packDraftId]);

    const compatibleProposals = useMemo(() => {
        if (!draft) return [];
        return proposals.filter((proposal) => canAdopt(proposal, draft));
    }, [draft, proposals]);

    const saveStatus = async () => {
        if (!packDraftId) return;
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            const next = await updatePackDraftStatus(packDraftId, status);
            setDraft(next);
            setSaved(true);
            if (next.status === "approved" && exportForm.pack_class === "draft") {
                setExportForm((current) => ({ ...current, pack_class: "official" }));
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const adopt = async (proposalId: string) => {
        if (!packDraftId) return;
        setAdoptingId(proposalId);
        setError("");
        setSaved(false);
        try {
            const next = await adoptProposalIntoPackDraft(packDraftId, proposalId);
            setDraft(next);
            setSaved(true);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setAdoptingId("");
        }
    };

    const exportDraft = async () => {
        if (!packDraftId) return;
        setExporting(true);
        setError("");
        setSaved(false);
        setExportedPath("");
        try {
            const result = await exportPackDraft(packDraftId, {
                pack_id: exportForm.pack_id.trim(),
                pack_class: exportForm.pack_class,
                ...(exportForm.title.trim() && { title: exportForm.title.trim() }),
                ...(exportForm.author_label.trim() && { author_label: exportForm.author_label.trim() }),
                is_published: exportForm.is_published,
                overwrite: exportForm.overwrite,
            });
            setExportedPath(result.path);
            setSaved(true);
            await load();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <p style={{ color: "var(--muted)" }}>Loading...</p>;
    if (!draft) return <div className="error-msg">{error || "Pack draft not found"}</div>;
    const canExport = ["approved", "published"].includes(draft.status) && draft.entries.length > 0;

    return (
        <div>
            <div className="section-heading">
                <div>
                    <h1>Pack Draft Detail</h1>
                    <p className="card-meta">{draft.pack_draft_id}</p>
                </div>
                <div className="section-actions">
                    {draft.type === "TRANSLATION" && draft.target_series_id && draft.target_episode_id && (
                        <Link
                            to={`/works/${draft.target_series_id}/episodes/${draft.target_episode_id}/translation-import`}
                            className="btn btn-outline"
                        >
                            EN Translation import
                        </Link>
                    )}
                    <span className="badge">{draft.status}</span>
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {saved && <div className="success-msg">Pack draft updated.</div>}
            {exportedPath && <div className="success-msg">Canonical Pack exported: {exportedPath}</div>}
            {draft.status === "published" && (
                <div className="success-msg">Published status is review state only. Canonical Pack export is still a separate workflow.</div>
            )}

            <div className="grid-2">
                <div className="card">
                    <h2>Draft</h2>
                    <dl className="detail-list">
                        <dt>Title</dt><dd>{draft.title}</dd>
                        <dt>Type</dt><dd>{draft.type}</dd>
                        <dt>Language</dt><dd>{draft.language ?? "-"}</dd>
                        <dt>Series</dt><dd>{draft.target_series_id ?? "-"}</dd>
                        <dt>Episode</dt><dd>{draft.target_episode_id ?? "-"}</dd>
                        <dt>Version</dt><dd>{draft.version}</dd>
                        <dt>Entries</dt><dd>{draft.entries.length}</dd>
                        <dt>Updated</dt><dd>{new Date(draft.updated_at).toLocaleString("ja-JP")}</dd>
                    </dl>
                </div>

                <div className="card">
                    <h2>Review</h2>
                    <div className="form-group">
                        <label>Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value as PackDraftStatus)}>
                            {PACK_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </div>
                    <button type="button" className="btn btn-primary" disabled={saving} onClick={saveStatus}>
                        {saving ? "Saving..." : "Save status"}
                    </button>
                </div>
            </div>

            <div className="card">
                <h2>Canonical Pack Export</h2>
                {!canExport && (
                    <div className="error-msg">Export requires at least one entry and status approved or published.</div>
                )}
                <div className="grid-2">
                    <div className="form-group">
                        <label htmlFor="pack-export-id">Pack ID</label>
                        <input id="pack-export-id" value={exportForm.pack_id} onChange={(e) => setExportForm({ ...exportForm, pack_id: e.target.value })} placeholder="translation-en-rain-world" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="pack-export-class">Pack class</label>
                        <select id="pack-export-class" value={exportForm.pack_class} onChange={(e) => setExportForm({ ...exportForm, pack_class: e.target.value as PackClass })}>
                            <option value="draft">draft</option>
                            <option value="official">official</option>
                            <option value="proposal">proposal</option>
                            <option value="deprecated">deprecated</option>
                        </select>
                    </div>
                </div>
                <div className="grid-2">
                    <div className="form-group">
                        <label htmlFor="pack-export-title">Title override</label>
                        <input id="pack-export-title" value={exportForm.title} onChange={(e) => setExportForm({ ...exportForm, title: e.target.value })} placeholder={draft.title} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="pack-export-author">Author label</label>
                        <input id="pack-export-author" value={exportForm.author_label} onChange={(e) => setExportForm({ ...exportForm, author_label: e.target.value })} placeholder="community" />
                    </div>
                </div>
                <div className="section-actions" style={{ marginTop: 0 }}>
                    <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input type="checkbox" checked={exportForm.is_published} onChange={(e) => setExportForm({ ...exportForm, is_published: e.target.checked })} />
                        Mark canonical Pack as published
                    </label>
                    <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <input type="checkbox" checked={exportForm.overwrite} onChange={(e) => setExportForm({ ...exportForm, overwrite: e.target.checked })} />
                        Overwrite existing pack
                    </label>
                    <button type="button" className="btn btn-primary" disabled={!canExport || exporting || !exportForm.pack_id.trim()} onClick={exportDraft}>
                        {exporting ? "Exporting..." : "Export Pack"}
                    </button>
                </div>
            </div>

            <div className="card">
                <h2>Entries</h2>
                {draft.entries.length === 0 ? (
                    <div className="empty-state">No entries adopted yet.</div>
                ) : (
                    <div className="compact-list">
                        {draft.entries.map((entry) => (
                            <div key={entry.entry_id} className="compact-list-item">
                                <div className="card-title">{entry.text ?? entry.note ?? entry.entry_id}</div>
                                <div className="card-meta">
                                    {entry.target.series_id} / {entry.target.episode_id ?? "-"} / {entry.target.page_id ?? "-"} / {entry.target.bubble_id ?? "-"}
                                </div>
                                <div className="card-meta">
                                    <span className={`badge ${translationOriginBadgeClass(translationOriginOfEntry(entry))}`}>
                                        {translationOriginLabel(translationOriginOfEntry(entry))}
                                    </span>
                                    {entry.metadata?.provider && <span> provider: {entry.metadata.provider}</span>}
                                    {entry.metadata?.model && <span> / model: {entry.metadata.model}</span>}
                                    {entry.metadata?.confidence !== undefined && <span> / confidence: {entry.metadata.confidence}</span>}
                                </div>
                                <div className="card-meta">
                                    {entry.lang ?? "-"} · {new Date(entry.adopted_at).toLocaleString("ja-JP")} · {entry.source_proposal_id ?? "-"}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card">
                <h2>Accepted Proposals</h2>
                {compatibleProposals.length === 0 ? (
                    <div className="empty-state">No compatible accepted proposals.</div>
                ) : (
                    <div className="compact-list">
                        {compatibleProposals.map((proposal) => (
                            <div key={proposal.proposal_id} className="compact-list-item">
                                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                                    <div>
                                        <div className="card-title">{proposal.kind} · {proposal.series_id} / {proposal.episode_id}</div>
                                        <div className="card-meta">
                                            {proposal.lang ?? "-"} · {proposal.page_id ?? "episode"} · {proposal.bubble_id ?? "-"}
                                        </div>
                                        {(proposal.suggested_text || proposal.comment) && (
                                            <p style={{ marginTop: "0.5rem" }}>{proposal.suggested_text ?? proposal.comment}</p>
                                        )}
                                    </div>
                                    <button type="button" className="btn btn-primary btn-compact" disabled={adoptingId === proposal.proposal_id} onClick={() => adopt(proposal.proposal_id)}>
                                        {adoptingId === proposal.proposal_id ? "Adopting..." : "Adopt"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="section-actions">
                <Link to="/pack-drafts" className="btn btn-outline">Back to pack drafts</Link>
            </div>
        </div>
    );
}
