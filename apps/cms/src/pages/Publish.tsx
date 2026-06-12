import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSeries, publishSeries, type SeriesDetail } from "../api";
import { useTranslation } from "../i18n/I18nProvider";
import { getSeriesLifecycleStatus } from "../publication";

export default function Publish() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const [work, setWork] = useState<SeriesDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [result, setResult] = useState<{ published: boolean; viewerUrl: string; apiUrl: string } | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;
        getSeries(id)
            .then((s) => { setWork(s); if (!s) setError("作品が見つかりません"); })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handlePublish = async () => {
        if (!id) return;
        setPublishing(true);
        setError("");
        try {
            const res = await publishSeries(id);
            setResult(res);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setPublishing(false);
        }
    };

    if (loading) return <p style={{ color: "var(--muted)" }}>{t("common.loading")}</p>;
    if (!work) return <div className="error-msg">作品が見つかりません</div>;

    return (
        <div>
            <h1>{t("work.publish.review")}</h1>
            <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
                {work.title} — {t("common.episodeCount", { count: work.episodes.length })}
            </p>

            <h2>series.json Preview</h2>
            <div className="json-preview">
                {JSON.stringify({
                    id: work.id,
                    title: work.title,
                    description: work.description,
                    publicationType: work.publicationType ?? "serial",
                    lifecycleStatus: getSeriesLifecycleStatus(work),
                    status: work.status,
                    cover: work.coverUrl,
                    publishStartAt: work.publishStartAt,
                    publishEndAt: work.publishEndAt,
                    visibility: work.visibility,
                    episodes: work.episodes.map((ep) => ep.id),
                }, null, 2)}
            </div>

            {work.episodes.map((ep) => (
                <div key={ep.id}>
                    <h2>{ep.id}/episode.json</h2>
                    <div className="json-preview">
                        {JSON.stringify({
                            id: ep.id,
                            episodeNumber: ep.episodeNumber,
                            title: ep.title,
                            publishedAt: ep.publishedAt,
                            publishStartAt: ep.publishStartAt,
                            publishEndAt: ep.publishEndAt,
                            visibility: ep.visibility,
                            pageCount: ep.pageCount,
                        }, null, 2)}
                    </div>
                </div>
            ))}

            {error && <div className="error-msg">{error}</div>}

            {result ? (
                <div className="success-msg">
                    <p>✅ Published successfully!</p>
                    <p style={{ marginTop: "0.5rem" }}>
                        <strong>Viewer:</strong>{" "}
                        <a href={result.viewerUrl} target="_blank" rel="noreferrer">{result.viewerUrl}</a>
                    </p>
                    <p>
                        <strong>API:</strong>{" "}
                        <a href={result.apiUrl} target="_blank" rel="noreferrer">{result.apiUrl}</a>
                    </p>
                    <div style={{ marginTop: "1rem" }}>
                        <Link to={`/works/${id}`} className="btn btn-outline">← 作品に戻る</Link>
                    </div>
                </div>
            ) : (
                <div className="section-actions">
                    <button onClick={handlePublish} className="btn btn-success" disabled={publishing}>
                        {publishing ? "Publishing…" : "🚀 Publish to contents/"}
                    </button>
                    <Link to={`/works/${id}`} className="btn btn-outline">
                        ← 戻る
                    </Link>
                </div>
            )}
        </div>
    );
}
