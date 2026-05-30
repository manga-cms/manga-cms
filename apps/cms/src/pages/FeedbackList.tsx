import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listFeedback, type FeedbackRecord, type FeedbackStatus } from "../api";

const STATUS_CLASS: Record<FeedbackStatus, string> = {
    new: "badge-warn",
    triaged: "",
    closed: "badge-muted",
};

export default function FeedbackList() {
    const [items, setItems] = useState<FeedbackRecord[]>([]);
    const [status, setStatus] = useState<FeedbackStatus | "all">("new");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        setLoading(true);
        setError("");
        listFeedback(status === "all" ? undefined : status)
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [status]);

    return (
        <div>
            <div className="section-heading">
                <div>
                    <h1>Feedback Triage</h1>
                    <p className="card-meta">Reader feedback stays private until it is reviewed in CMS.</p>
                </div>
                <select style={{ width: "11rem" }} value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus | "all")}>
                    <option value="new">New</option>
                    <option value="triaged">Triaged</option>
                    <option value="closed">Closed</option>
                    <option value="all">All</option>
                </select>
            </div>

            {error && <div className="error-msg">{error}</div>}

            {loading ? (
                <p style={{ color: "var(--muted)" }}>Loading…</p>
            ) : items.length === 0 ? (
                <div className="card empty-state">Feedback is empty.</div>
            ) : (
                <div className="episode-list">
                    {items.map((item) => (
                        <Link key={item.feedback_id} to={`/feedback/${item.feedback_id}`} className="card card-link">
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                                <div>
                                    <div className="card-title">
                                        {item.issue_type} · {item.series_id} / {item.episode_id}
                                    </div>
                                    <div className="card-meta">
                                        {item.mode} · {item.page_id ?? "episode"} · {new Date(item.created_at).toLocaleString("ja-JP")}
                                    </div>
                                    {item.comment && <p style={{ marginTop: "0.5rem", color: "var(--text)" }}>{item.comment}</p>}
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
