import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listFeedback, type FeedbackRecord, type FeedbackStatus } from "../api";
import {
    feedbackIdentityLabel,
    feedbackIdentityLevel,
    feedbackTargetKind,
    feedbackTargetLabel,
    formatFeedbackDate,
    type FeedbackIdentityFilter,
    type FeedbackTargetKind,
} from "../lib/feedbackTriage";
import { useTranslation } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";

const STATUS_CLASS: Record<FeedbackStatus, string> = {
    new: "badge-warn",
    triaged: "",
    closed: "badge-muted",
};

const feedbackStatusLabelKey = (status: FeedbackStatus): MessageKey => `feedback.status.${status}` as MessageKey;

type FeedbackIssueType = FeedbackRecord["issue_type"];

const ISSUE_TYPES: FeedbackIssueType[] = [
    "typo",
    "mistranslation",
    "better_translation",
    "missing_note",
    "display",
    "broken_link",
    "spoiler",
    "other",
];

function shortText(value: string | undefined, fallback = "-") {
    if (!value?.trim()) return fallback;
    return value.length > 180 ? `${value.slice(0, 180)}...` : value;
}

export default function FeedbackList() {
    const { t } = useTranslation();
    const [items, setItems] = useState<FeedbackRecord[]>([]);
    const [status, setStatus] = useState<FeedbackStatus | "all">("new");
    const [seriesId, setSeriesId] = useState("");
    const [episodeId, setEpisodeId] = useState("");
    const [issueType, setIssueType] = useState<FeedbackIssueType | "all">("all");
    const [targetKind, setTargetKind] = useState<FeedbackTargetKind | "all">("all");
    const [identity, setIdentity] = useState<FeedbackIdentityFilter>("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        setLoading(true);
        setError("");
        listFeedback({
            ...(status !== "all" && { status }),
            ...(seriesId.trim() && { seriesId: seriesId.trim() }),
        })
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [seriesId, status]);

    const filteredItems = useMemo(() => {
        const episodeFilter = episodeId.trim();
        return items.filter((item) => {
            if (issueType !== "all" && item.issue_type !== issueType) return false;
            if (episodeFilter && item.episode_id !== episodeFilter) return false;
            if (targetKind !== "all" && feedbackTargetKind(item) !== targetKind) return false;
            if (identity !== "all" && feedbackIdentityLevel(item) !== identity) return false;
            return true;
        });
    }, [episodeId, identity, issueType, items, targetKind]);

    return (
        <div className="feedback-triage-page">
            <div className="section-heading">
                <div>
                    <h1>{t("feedback.list.title")}</h1>
                    <p className="card-meta">Reader feedback を非公開のまま確認し、必要なものだけ Proposal / GitHub handoff に進めます。</p>
                </div>
                <div className="feedback-result-count">
                    <span className="badge">{t("feedback.list.shown", { count: filteredItems.length })}</span>
                    <span className="badge badge-muted">{t("feedback.list.loaded", { count: items.length })}</span>
                </div>
            </div>

            <div className="card feedback-filter-card">
                <div className="feedback-filter-grid">
                    <div className="form-group">
                        <label>{t("feedback.filter.status")}</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus | "all")}>
                            <option value="new">{t("feedback.status.new")}</option>
                            <option value="triaged">{t("feedback.status.triaged")}</option>
                            <option value="closed">{t("feedback.status.closed")}</option>
                            <option value="all">{t("common.all")}</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t("feedback.filter.seriesId")}</label>
                        <input value={seriesId} onChange={(e) => setSeriesId(e.target.value)} placeholder="oumaga-dokidoki" />
                    </div>
                    <div className="form-group">
                        <label>issue_type</label>
                        <select value={issueType} onChange={(e) => setIssueType(e.target.value as FeedbackIssueType | "all")}>
                            <option value="all">{t("common.all")}</option>
                            {ISSUE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>episodeId</label>
                        <input value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} placeholder="ep01" />
                    </div>
                    <div className="form-group">
                        <label>target</label>
                        <select value={targetKind} onChange={(e) => setTargetKind(e.target.value as FeedbackTargetKind | "all")}>
                            <option value="all">{t("common.all")}</option>
                            <option value="episode">{t("feedback.target.episode")}</option>
                            <option value="page">{t("feedback.target.page")}</option>
                            <option value="panel">{t("feedback.target.panel")}</option>
                            <option value="bubble">{t("feedback.target.bubble")}</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>contributor identity</label>
                        <select value={identity} onChange={(e) => setIdentity(e.target.value as FeedbackIdentityFilter)}>
                            <option value="all">{t("common.all")}</option>
                            <option value="anonymous">anonymous</option>
                            <option value="display_name">display_name</option>
                            <option value="github_login">github_login</option>
                            <option value="user_id">user_id</option>
                        </select>
                    </div>
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            {loading ? (
                <p style={{ color: "var(--muted)" }}>{t("common.loading")}</p>
            ) : filteredItems.length === 0 ? (
                <div className="card empty-state">{t("feedback.list.empty")}</div>
            ) : (
                <div className="feedback-list">
                    {filteredItems.map((item) => (
                        <Link key={item.feedback_id} to={`/feedback/${item.feedback_id}`} className="card card-link feedback-list-card">
                            <div className="feedback-list-header">
                                <div>
                                    <div className="feedback-list-title">
                                        <span className="badge">{item.issue_type}</span>
                                        <strong>{feedbackTargetLabel(item)}</strong>
                                    </div>
                                    <div className="card-meta">
                                        {feedbackTargetKind(item)} target · {item.mode} · {feedbackIdentityLabel(item)} · {formatFeedbackDate(item.created_at)}
                                    </div>
                                </div>
                                <span className={`badge ${STATUS_CLASS[item.status]}`}>{t(feedbackStatusLabelKey(item.status))}</span>
                            </div>
                            <div className="feedback-list-body">
                                <div className="feedback-list-text">
                                    <span>current_text</span>
                                    <p>{shortText(item.current_text)}</p>
                                </div>
                                <div className="feedback-list-text">
                                    <span>comment</span>
                                    <p>{shortText(item.comment)}</p>
                                </div>
                            </div>
                            <div className="feedback-list-meta">
                                <span>{item.lang ?? "lang -"}</span>
                                <span>{item.current_translation ? "has current_translation" : "no current_translation"}</span>
                                <span>{item.suggested_text ? "has suggested_text" : "no suggested_text"}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
