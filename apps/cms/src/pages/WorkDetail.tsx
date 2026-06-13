import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    getAdminEpisode,
    getSeries,
    saveEpisode,
    updateSeries,
    type ContentPublicMetadata,
    type LocalizedContentMetadata,
    type PublicationVisibility,
    type SeriesDetail,
    type SeriesLifecycleStatus,
    type SeriesPublicationType,
} from "../api";
import {
    formatPublicationDate,
    formatSeriesLifecycleStatus,
    formatSeriesPublicationType,
    getSeriesLifecycleStatus,
    getPublicationState,
    publicationInputPayload,
    toLocalDateTimeInput,
    type PublicationFormState,
} from "../publication";
import { useTranslation } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n/messages";

const publicationStateLabelKey = (state: string): MessageKey => `publication.state.${state}` as MessageKey;

interface SeriesMetadataFormState {
    titleJa: string;
    descriptionJa: string;
    authorLabelJa: string;
    titleEn: string;
    descriptionEn: string;
    authorLabelEn: string;
    publicationType: SeriesPublicationType;
    lifecycleStatus: SeriesLifecycleStatus;
}

function localizedField(metadata: ContentPublicMetadata | undefined, locale: "ja" | "en", field: keyof LocalizedContentMetadata) {
    return metadata?.localized?.[locale]?.[field] ?? "";
}

function withOptionalText<T extends Record<string, unknown>>(target: T, key: keyof LocalizedContentMetadata, value: string) {
    const trimmed = value.trim();
    if (trimmed) return { ...target, [key]: trimmed };
    const { [key]: _removed, ...rest } = target;
    return rest as T;
}

function hasMetadataValue(value: unknown): boolean {
    if (value === undefined) return false;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    return true;
}

function buildSeriesPublicMetadata(current: ContentPublicMetadata | undefined, form: SeriesMetadataFormState): ContentPublicMetadata | undefined {
    const metadata: ContentPublicMetadata = { ...(current ?? {}) };
    const authorLabelJa = form.authorLabelJa.trim();
    if (authorLabelJa) {
        metadata.authorLabel = authorLabelJa;
    } else {
        delete metadata.authorLabel;
    }

    const currentLocalized = metadata.localized ?? {};
    const nextLocalized: Record<string, LocalizedContentMetadata> = { ...currentLocalized };

    const setLocalized = (locale: "ja" | "en") => {
        const existing = { ...(currentLocalized[locale] ?? {}) };
        const title = locale === "ja" ? form.titleJa : form.titleEn;
        const description = locale === "ja" ? form.descriptionJa : form.descriptionEn;
        const authorLabel = locale === "ja" ? form.authorLabelJa : form.authorLabelEn;
        let next = withOptionalText(existing, "title", title);
        next = withOptionalText(next, "description", description);
        next = withOptionalText(next, "authorLabel", authorLabel);
        if (Object.keys(next).length > 0) {
            nextLocalized[locale] = next;
        } else {
            delete nextLocalized[locale];
        }
    };

    setLocalized("ja");
    setLocalized("en");

    if (Object.keys(nextLocalized).length > 0) {
        metadata.localized = nextLocalized;
    } else {
        delete metadata.localized;
    }

    return Object.values(metadata).some(hasMetadataValue) ? metadata : undefined;
}

type WorkDetailProps = {
    currentUser?: { role: string } | null;
};

export default function WorkDetail({ currentUser }: WorkDetailProps) {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const [work, setWork] = useState<SeriesDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [metadataSaved, setMetadataSaved] = useState(false);
    const [scheduleSaved, setScheduleSaved] = useState(false);
    const [bulkSaved, setBulkSaved] = useState(false);
    const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<string[]>([]);
    const [seriesMetadata, setSeriesMetadata] = useState<SeriesMetadataFormState>({
        titleJa: "",
        descriptionJa: "",
        authorLabelJa: "",
        titleEn: "",
        descriptionEn: "",
        authorLabelEn: "",
        publicationType: "serial",
        lifecycleStatus: "ongoing",
    });
    const [seriesSchedule, setSeriesSchedule] = useState<PublicationFormState>({
        visibility: "public",
        publishStartAt: "",
        publishEndAt: "",
    });
    const [episodeBulkSchedule, setEpisodeBulkSchedule] = useState<PublicationFormState>({
        visibility: "public",
        publishStartAt: "",
        publishEndAt: "",
    });

    // Add episode form
    const [showForm, setShowForm] = useState(false);
    const [epId, setEpId] = useState("");
    const [epNum, setEpNum] = useState(1);
    const [epTitle, setEpTitle] = useState("");
    const [saving, setSaving] = useState(false);

    const applyWork = (next: SeriesDetail | null) => {
        setWork(next);
        if (!next) return;
        setSeriesMetadata({
            titleJa: localizedField(next.metadata, "ja", "title") || next.title,
            descriptionJa: localizedField(next.metadata, "ja", "description") || next.description,
            authorLabelJa: localizedField(next.metadata, "ja", "authorLabel") || next.metadata?.authorLabel || "",
            titleEn: localizedField(next.metadata, "en", "title"),
            descriptionEn: localizedField(next.metadata, "en", "description"),
            authorLabelEn: localizedField(next.metadata, "en", "authorLabel"),
            publicationType: next.publicationType ?? "serial",
            lifecycleStatus: getSeriesLifecycleStatus(next),
        });
        setSeriesSchedule({
            visibility: next.visibility ?? "public",
            publishStartAt: toLocalDateTimeInput(next.publishStartAt),
            publishEndAt: toLocalDateTimeInput(next.publishEndAt),
        });
    };

    useEffect(() => {
        if (!id) return;
        getSeries(id)
            .then((s) => { applyWork(s); if (!s) setError("作品が見つかりません"); })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleSeriesMetadataSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        const title = seriesMetadata.titleJa.trim();
        if (!title) {
            setError("タイトルを入力してください");
            return;
        }
        setSaving(true);
        setError("");
        setMetadataSaved(false);
        setScheduleSaved(false);
        try {
            await updateSeries(id, {
                title,
                description: seriesMetadata.descriptionJa,
                publicationType: seriesMetadata.publicationType,
                lifecycleStatus: seriesMetadata.lifecycleStatus,
                status: seriesMetadata.lifecycleStatus,
                metadata: buildSeriesPublicMetadata(work?.metadata, seriesMetadata),
            });
            const updated = await getSeries(id);
            applyWork(updated);
            setMetadataSaved(true);
            setBulkSaved(false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleSeriesScheduleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;
        setSaving(true);
        setError("");
        setMetadataSaved(false);
        setScheduleSaved(false);
        try {
            await updateSeries(id, publicationInputPayload(seriesSchedule));
            const updated = await getSeries(id);
            applyWork(updated);
            setScheduleSaved(true);
            setBulkSaved(false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const toggleEpisodeSelection = (episodeId: string) => {
        setSelectedEpisodeIds((current) =>
            current.includes(episodeId)
                ? current.filter((id) => id !== episodeId)
                : [...current, episodeId],
        );
    };

    const handleBulkEpisodeScheduleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || selectedEpisodeIds.length === 0) return;
        setSaving(true);
        setError("");
        setScheduleSaved(false);
        setBulkSaved(false);
        try {
            const payload = publicationInputPayload(episodeBulkSchedule);
            for (const episodeId of selectedEpisodeIds) {
                const episode = await getAdminEpisode(id, episodeId);
                if (!episode) throw new Error(`Episode not found: ${episodeId}`);
                await saveEpisode(id, {
                    id: episode.id,
                    episodeNumber: episode.episodeNumber,
                    title: episode.title,
                    publishedAt: episode.publishedAt,
                    ...payload,
                    pages: episode.pages,
                });
            }
            const updated = await getSeries(id);
            applyWork(updated);
            setSelectedEpisodeIds([]);
            setBulkSaved(true);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddEpisode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !epId.trim() || !epTitle.trim()) return;

        setSaving(true);
        setError("");
        try {
            await saveEpisode(id, {
                id: epId,
                episodeNumber: epNum,
                title: epTitle,
                pages: [],
            });
            // Refresh
            const updated = await getSeries(id);
            applyWork(updated);
            setShowForm(false);
            setEpId("");
            setEpTitle("");
            setEpNum((work?.episodes.length ?? 0) + 2);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p style={{ color: "var(--muted)" }}>{t("common.loading")}</p>;
    if (!work) return <div className="error-msg">{error || "作品が見つかりません"}</div>;
    const seriesPublicationState = getPublicationState(work);
    const lifecycleStatus = getSeriesLifecycleStatus(work);
    const publicationType = work.publicationType ?? "serial";
    const authorLabel = work.metadata?.localized?.ja?.authorLabel ?? work.metadata?.authorLabel;

    return (
        <div>
            <h1>{work.title}</h1>
            <p style={{ color: "var(--muted)", marginBottom: "0.35rem" }}>{work.description}</p>
            {authorLabel && <p className="card-meta" style={{ marginBottom: "1rem" }}>作者: {authorLabel}</p>}
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                {publicationType === "oneshot" && <><span className="badge">{formatSeriesPublicationType(publicationType)}</span>{" "}</>}
                <span className="badge">{formatSeriesLifecycleStatus(lifecycleStatus)}</span>{" "}
                <span className={`badge publication-${seriesPublicationState}`}>{t(publicationStateLabelKey(seriesPublicationState))}</span>{" "}
                ID: {work.id} — {t("common.episodeCount", { count: work.episodes.length })}
            </p>
            {error && <div className="error-msg">{error}</div>}

            <form onSubmit={handleSeriesMetadataSave} className="card publication-card">
                <div className="section-heading">
                    <div>
                        <h2>作品メタデータ</h2>
                        <p className="card-meta">作品種別、制作状態、多言語タイトル、作者表示名を編集します。legacy status は lifecycleStatus と同期して保存します。</p>
                    </div>
                    <div className="section-actions">
                        <span className="badge">{formatSeriesPublicationType(publicationType)}</span>
                        <span className="badge">{formatSeriesLifecycleStatus(lifecycleStatus)}</span>
                    </div>
                </div>
                {seriesMetadata.publicationType === "oneshot" && (
                    <div className="info-msg">
                        読切作品として扱います。公開表示や共有文言では「Episode 1」を強制せず、作品タイトルまたは localized title を優先します。
                    </div>
                )}
                <div className="publication-grid">
                    <div className="form-group">
                        <label>日本語タイトル</label>
                        <input
                            value={seriesMetadata.titleJa}
                            onChange={(e) => setSeriesMetadata((current) => ({ ...current, titleJa: e.target.value }))}
                            placeholder="逢魔がドキドキ"
                        />
                    </div>
                    <div className="form-group">
                        <label>日本語 作者名</label>
                        <input
                            value={seriesMetadata.authorLabelJa}
                            onChange={(e) => setSeriesMetadata((current) => ({ ...current, authorLabelJa: e.target.value }))}
                            placeholder="作者名 / サークル名"
                        />
                    </div>
                    <div className="form-group">
                        <label>作品種別</label>
                        <select
                            value={seriesMetadata.publicationType}
                            onChange={(e) => setSeriesMetadata((current) => ({
                                ...current,
                                publicationType: e.target.value as SeriesPublicationType,
                            }))}
                        >
                            <option value="serial">連載</option>
                            <option value="oneshot">読切</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>制作状態</label>
                        <select
                            value={seriesMetadata.lifecycleStatus}
                            onChange={(e) => setSeriesMetadata((current) => ({
                                ...current,
                                lifecycleStatus: e.target.value as SeriesLifecycleStatus,
                            }))}
                        >
                            <option value="ongoing">連載中</option>
                            <option value="completed">完結</option>
                            <option value="hiatus">休載</option>
                        </select>
                    </div>
                </div>
                <div className="form-group">
                    <label>日本語説明</label>
                    <textarea
                        value={seriesMetadata.descriptionJa}
                        onChange={(e) => setSeriesMetadata((current) => ({ ...current, descriptionJa: e.target.value }))}
                        placeholder="作品の概要"
                    />
                </div>
                <div className="localized-metadata-panel">
                    <div className="section-heading">
                        <div>
                            <h3>English metadata</h3>
                            <p className="card-meta">Reader / OGP 用の英語表示情報です。漫画本文の英語翻訳は Translation Pack Draft で管理します。</p>
                        </div>
                    </div>
                    <div className="publication-grid">
                        <div className="form-group">
                            <label>English title</label>
                            <input
                                value={seriesMetadata.titleEn}
                                onChange={(e) => setSeriesMetadata((current) => ({ ...current, titleEn: e.target.value }))}
                                placeholder={t("work.metadata.englishTitlePlaceholder")}
                            />
                        </div>
                        <div className="form-group">
                            <label>English authorLabel</label>
                            <input
                                value={seriesMetadata.authorLabelEn}
                                onChange={(e) => setSeriesMetadata((current) => ({ ...current, authorLabelEn: e.target.value }))}
                                placeholder="Creator display name"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>English description</label>
                        <textarea
                            value={seriesMetadata.descriptionEn}
                            onChange={(e) => setSeriesMetadata((current) => ({ ...current, descriptionEn: e.target.value }))}
                            placeholder="English public description"
                        />
                    </div>
                </div>
                {metadataSaved && <div className="success-msg">作品メタデータを保存しました。</div>}
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "保存中…" : "メタデータを保存"}
                </button>
            </form>

            <form onSubmit={handleSeriesScheduleSave} className="card publication-card">
                <div className="section-heading">
                    <div>
                        <h2>{t("work.publication.title")}</h2>
                        <p className="card-meta">{t("work.publication.description")}</p>
                    </div>
                    <span className={`badge publication-${seriesPublicationState}`}>{t(publicationStateLabelKey(seriesPublicationState))}</span>
                </div>
                <div className="publication-grid">
                    <div className="form-group">
                        <label>{t("work.publication.visibility")}</label>
                        <select
                            value={seriesSchedule.visibility}
                            onChange={(e) => setSeriesSchedule((current) => ({ ...current, visibility: e.target.value as PublicationVisibility }))}
                        >
                            <option value="public">{t("publication.state.public")}</option>
                            <option value="hidden">{t("publication.state.hidden")}</option>
                            <option value="archived">{t("publication.state.archived")}</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t("work.publication.start")}</label>
                        <input
                            type="datetime-local"
                            value={seriesSchedule.publishStartAt}
                            onChange={(e) => setSeriesSchedule((current) => ({ ...current, publishStartAt: e.target.value }))}
                        />
                    </div>
                    <div className="form-group">
                        <label>{t("work.publication.end")}</label>
                        <input
                            type="datetime-local"
                            value={seriesSchedule.publishEndAt}
                            onChange={(e) => setSeriesSchedule((current) => ({ ...current, publishEndAt: e.target.value }))}
                        />
                    </div>
                </div>
                <div className="publication-summary">
                    <span>{t("work.publication.start")}: {formatPublicationDate(work.publishStartAt)}</span>
                    <span>{t("work.publication.end")}: {formatPublicationDate(work.publishEndAt)}</span>
                </div>
                {scheduleSaved && <div className="success-msg">{t("work.publication.saved")}</div>}
                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "保存中…" : "公開設定を保存"}
                </button>
            </form>

            <div style={{ display: "flex", gap: "0.75rem", margin: "1.5rem 0" }}>
                <button className="btn btn-outline" onClick={() => setShowForm(!showForm)}>
                    {showForm ? "キャンセル" : "+ エピソードを追加"}
                </button>
                <Link to={`/works/${id}/publish`} className="btn btn-success">
                    {t("work.publish.review")}
                </Link>
            </div>

            {showForm && (
                <form onSubmit={handleAddEpisode} className="card" style={{ maxWidth: "28rem", marginBottom: "1.5rem" }}>
                    <div className="form-group">
                        <label>Episode ID (slug)</label>
                        <input value={epId} onChange={(e) => setEpId(e.target.value)} placeholder="ep01" />
                    </div>
                    <div className="form-group">
                        <label>Episode Number</label>
                        <input type="number" min={1} value={epNum} onChange={(e) => setEpNum(Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                        <label>タイトル</label>
                        <input value={epTitle} onChange={(e) => setEpTitle(e.target.value)} placeholder="第1話 雨の始まり" />
                    </div>
                    {error && <div className="error-msg">{error}</div>}
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "保存中…" : "エピソードを保存"}
                    </button>
                </form>
            )}

            <h2>Episodes</h2>
            {work.episodes.length > 0 && (
                <form onSubmit={handleBulkEpisodeScheduleSave} className="card publication-card">
                    <div className="section-heading">
                        <div>
                            <h3>{t("work.bulkPublication.title")}</h3>
                            <p className="card-meta">{t("work.bulkPublication.description")}</p>
                        </div>
                        <span className="badge">{t("work.bulkPublication.selected", { count: selectedEpisodeIds.length })}</span>
                    </div>
                    <div className="publication-grid">
                        <div className="form-group">
                            <label>{t("work.publication.visibility")}</label>
                            <select
                                value={episodeBulkSchedule.visibility}
                                onChange={(e) => setEpisodeBulkSchedule((current) => ({ ...current, visibility: e.target.value as PublicationVisibility }))}
                            >
                                <option value="public">{t("publication.state.public")}</option>
                                <option value="hidden">{t("publication.state.hidden")}</option>
                                <option value="archived">{t("publication.state.archived")}</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>{t("work.publication.start")}</label>
                            <input
                                type="datetime-local"
                                value={episodeBulkSchedule.publishStartAt}
                                onChange={(e) => setEpisodeBulkSchedule((current) => ({ ...current, publishStartAt: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>{t("work.publication.end")}</label>
                            <input
                                type="datetime-local"
                                value={episodeBulkSchedule.publishEndAt}
                                onChange={(e) => setEpisodeBulkSchedule((current) => ({ ...current, publishEndAt: e.target.value }))}
                            />
                        </div>
                    </div>
                    {bulkSaved && <div className="success-msg">{t("work.bulkPublication.saved")}</div>}
                    <div className="section-actions" style={{ marginTop: "1rem" }}>
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => setSelectedEpisodeIds(work.episodes.map((ep) => ep.id))}
                            disabled={saving}
                        >
                            {t("common.selectAll")}
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => setSelectedEpisodeIds([])}
                            disabled={saving || selectedEpisodeIds.length === 0}
                        >
                            {t("common.clear")}
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving || selectedEpisodeIds.length === 0}>
                            {saving ? "保存中…" : "選択したEpisodeに適用"}
                        </button>
                    </div>
                </form>
            )}
            {work.episodes.length === 0 ? (
                <div className="card empty-state">エピソードがまだありません</div>
            ) : (
                <div className="episode-list">
                    {work.episodes.map((ep) => (
                        <div key={ep.id} className="card">
                            <div className="card-title">
                                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", marginRight: "0.5rem" }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedEpisodeIds.includes(ep.id)}
                                        onChange={() => toggleEpisodeSelection(ep.id)}
                                        aria-label={`Select ${ep.title}`}
                                    />
                                </label>
                                <span className="badge" style={{ marginRight: "0.5rem" }}>
                                    {publicationType === "oneshot" ? "読切" : `EP${ep.episodeNumber}`}
                                </span>
                                <span className={`badge publication-${getPublicationState(ep)}`} style={{ marginRight: "0.5rem" }}>
                                    {t(publicationStateLabelKey(getPublicationState(ep)))}
                                </span>
                                {ep.title}
                            </div>
                            <div className="card-meta">
                                {t("common.pageCount", { count: ep.pageCount })} — {ep.publishedAt}
                                {ep.publishStartAt && <> — {t("work.publication.starts", { value: formatPublicationDate(ep.publishStartAt) })}</>}
                                {ep.publishEndAt && <> — {t("work.publication.ends", { value: formatPublicationDate(ep.publishEndAt) })}</>}
                            </div>
                            <div className="section-actions">
                                <Link to={`/works/${id}/episodes/${ep.id}`} className="btn btn-outline">Episode</Link>
                                <Link to={`/works/${id}/episodes/${ep.id}/structure`} className="btn btn-primary">Structure Review</Link>
                                {currentUser?.role === "admin" && (
                                    <Link to={`/works/${id}/episodes/${ep.id}/translation-import`} className="btn btn-outline">EN Translation import</Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
