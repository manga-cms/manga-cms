import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listJobs, type IngestionJob } from "../api";
import { useTranslation } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";

const STATUS_COLORS: Record<string, string> = {
    queued: "badge-muted",
    draft: "",
    waiting_review: "badge-warn",
    confirmed: "badge-ok",
    failed: "badge-err",
    canceled: "badge-muted",
};

const jobStatusLabelKey = (status: string): MessageKey => `ingestion.status.${status}` as MessageKey;

export default function JobsList() {
    const { t } = useTranslation();
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
                <h1>{t("ingestion.jobs.title")}</h1>
                <Link to="/ingestion/new" className="btn btn-primary">{t("ingestion.jobs.new")}</Link>
            </div>

            {loading ? (
                <p style={{ color: "var(--muted)" }}>{t("common.loading")}</p>
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
                                        {j.draft ? `${j.draft.seriesId} / ${j.draft.episodeId}` : t("ingestion.jobs.noDraft")}
                                        {" — "}{new Date(j.createdAt).toLocaleString("ja-JP")}
                                    </div>
                                </div>
                                <span className={`badge ${STATUS_COLORS[j.status] ?? ""}`}>
                                    {t(jobStatusLabelKey(j.status))}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
