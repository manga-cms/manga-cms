import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSeries, type SeriesItem } from "../api";
import { getPublicationState } from "../publication";

export default function Dashboard() {
    const [works, setWorks] = useState<SeriesItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        listSeries()
            .then(setWorks)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div>
            <h1>Dashboard</h1>

            {error && <div className="error-msg">{error}</div>}

            {loading ? (
                <p style={{ color: "var(--muted)" }}>Loading…</p>
            ) : works.length === 0 ? (
                <div className="card empty-state">
                    <p>作品がまだありません</p>
                    <Link to="/works/new" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                        + 最初の作品を作る
                    </Link>
                </div>
            ) : (
                <div className="grid-2">
                    {works.map((w) => (
                        <Link to={`/works/${w.id}`} key={w.id} className="card card-link">
                            <div className="card-title">{w.title}</div>
                            <div className="card-meta">
                                <span className={`badge ${w.status === "ongoing" ? "" : "badge-muted"}`}>
                                    {w.status}
                                </span>
                                {" "}
                                <span className={`badge publication-${getPublicationState(w)}`}>
                                    {getPublicationState(w)}
                                </span>
                                {" "}{w.episodeCount} episode(s)
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
