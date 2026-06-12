import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSeries, type SeriesItem } from "../api";
import {
    formatSeriesLifecycleStatus,
    formatSeriesPublicationType,
    getPublicationState,
    getSeriesLifecycleStatus,
} from "../publication";
import { useTranslation } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";

const publicationStateLabelKey = (state: string): MessageKey => `publication.state.${state}` as MessageKey;

export default function Dashboard() {
    const { t } = useTranslation();
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
            <h1>{t("dashboard.title")}</h1>

            {error && <div className="error-msg">{error}</div>}

            {loading ? (
                <p style={{ color: "var(--muted)" }}>{t("common.loading")}</p>
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
                                {w.publicationType === "oneshot" && (
                                    <>
                                        <span className="badge">
                                            {formatSeriesPublicationType(w.publicationType)}
                                        </span>
                                        {" "}
                                    </>
                                )}
                                <span className={`badge ${getSeriesLifecycleStatus(w) === "ongoing" ? "" : "badge-muted"}`}>
                                    {formatSeriesLifecycleStatus(getSeriesLifecycleStatus(w))}
                                </span>
                                {" "}
                                <span className={`badge publication-${getPublicationState(w)}`}>
                                    {t(publicationStateLabelKey(getPublicationState(w)))}
                                </span>
                                {" "}{t("common.episodeCount", { count: w.episodeCount })}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
