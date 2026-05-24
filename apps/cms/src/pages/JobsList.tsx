import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listJobs, type IngestionJob } from "../api";

const STATUS_COLORS: Record<string, string> = {
    queued: "badge-muted",
    draft: "",
    waiting_review: "badge-warn",
    confirmed: "badge-ok",
    failed: "badge-err",
    canceled: "badge-muted",
};

export default function JobsList() {
    const [jobs, setJobs] = useState<IngestionJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        listJobs()
            .then(setJobs)
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Ingestion Jobs</h1>
                <Link to="/ingestion/new" className="btn btn-primary">+ New Job</Link>
            </div>

            {loading ? (
                <p style={{ color: "var(--muted)" }}>Loading…</p>
            ) : jobs.length === 0 ? (
                <div className="card empty-state">
                    <p>取り込みジョブがありません</p>
                    <Link to="/ingestion/new" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                        最初のジョブを作成
                    </Link>
                </div>
            ) : (
                <div className="episode-list">
                    {jobs.map((j) => (
                        <Link to={`/ingestion/${j.id}`} key={j.id} className="card card-link">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div className="card-title">{j.label}</div>
                                    <div className="card-meta">
                                        {j.draft ? `${j.draft.seriesId} / ${j.draft.episodeId}` : "No draft"}
                                        {" — "}{new Date(j.createdAt).toLocaleString("ja-JP")}
                                    </div>
                                </div>
                                <span className={`badge ${STATUS_COLORS[j.status] ?? ""}`}>
                                    {j.status}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
