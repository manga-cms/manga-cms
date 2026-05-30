import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listProposals, type ProposalKind, type ProposalRecord, type ProposalStatus } from "../api";

const STATUS_CLASS: Record<ProposalStatus, string> = {
    new: "badge-warn",
    triaged: "",
    accepted: "badge-ok",
    rejected: "badge-muted",
    closed: "badge-muted",
};

export default function ProposalList() {
    const [items, setItems] = useState<ProposalRecord[]>([]);
    const [status, setStatus] = useState<ProposalStatus | "all">("new");
    const [kind, setKind] = useState<ProposalKind | "all">("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        setLoading(true);
        setError("");
        listProposals({
            ...(status !== "all" && { status }),
            ...(kind !== "all" && { kind }),
        })
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [status, kind]);

    return (
        <div>
            <div className="section-heading">
                <div>
                    <h1>Proposal Queue</h1>
                    <p className="card-meta">Review translation, typo, footnote, commentary, tag, and structure proposals.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <select style={{ width: "11rem" }} value={status} onChange={(e) => setStatus(e.target.value as ProposalStatus | "all")}>
                        <option value="new">New</option>
                        <option value="triaged">Triaged</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="closed">Closed</option>
                        <option value="all">All</option>
                    </select>
                    <select style={{ width: "12rem" }} value={kind} onChange={(e) => setKind(e.target.value as ProposalKind | "all")}>
                        <option value="all">All kinds</option>
                        <option value="translation">Translation</option>
                        <option value="typo">Typo</option>
                        <option value="footnote">Footnote</option>
                        <option value="commentary">Commentary</option>
                        <option value="tag">Tag</option>
                        <option value="structure">Structure</option>
                    </select>
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            {loading ? (
                <p style={{ color: "var(--muted)" }}>Loading...</p>
            ) : items.length === 0 ? (
                <div className="card empty-state">Proposal queue is empty.</div>
            ) : (
                <div className="episode-list">
                    {items.map((item) => (
                        <Link key={item.proposal_id} to={`/proposals/${item.proposal_id}`} className="card card-link">
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                                <div>
                                    <div className="card-title">
                                        {item.kind} · {item.series_id} / {item.episode_id}
                                    </div>
                                    <div className="card-meta">
                                        {item.page_id ?? "episode"} · {new Date(item.created_at).toLocaleString("ja-JP")}
                                    </div>
                                    {(item.suggested_text || item.comment) && (
                                        <p style={{ marginTop: "0.5rem", color: "var(--text)" }}>
                                            {item.suggested_text ?? item.comment}
                                        </p>
                                    )}
                                </div>
                                <span className={`badge ${STATUS_CLASS[item.status]}`}>{item.status}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
