import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    createRightsGrant,
    listRightsGrants,
    revokeRightsGrant,
    type RightsGrantRecord,
    type RightsPermission,
    type RightsRole,
    type RightsUsage,
} from "../api";

type StatusFilter = "active" | "revoked" | "all";
type PackType = "TRANSLATION" | "FOOTNOTE" | "COMMENTARY" | "LEARNING" | "ACCESSIBILITY";

const ROLE_OPTIONS: Array<{ value: RightsRole; label: string }> = [
    { value: "owner", label: "owner / 所有者" },
    { value: "editor", label: "editor / 編集者" },
    { value: "translator", label: "translator / 翻訳者" },
    { value: "reviewer", label: "reviewer / レビュー担当" },
    { value: "contributor", label: "contributor / 投稿者" },
    { value: "moderator", label: "moderator / モデレーター" },
    { value: "viewer", label: "viewer / 閲覧者" },
    { value: "original_rights_holder", label: "original_rights_holder / 原権利者" },
    { value: "translation_reviewer", label: "translation_reviewer / 翻訳レビュー" },
    { value: "footnote_contributor", label: "footnote_contributor / 脚注投稿" },
    { value: "pack_maintainer", label: "pack_maintainer / Pack管理" },
    { value: "publisher", label: "publisher / 公開担当" },
];

const PERMISSION_OPTIONS: Array<{ value: RightsPermission; label: string }> = [
    { value: "propose_translation", label: "翻訳提案" },
    { value: "propose_footnote", label: "脚注提案" },
    { value: "edit_structure", label: "構造編集" },
    { value: "edit_translation", label: "翻訳編集" },
    { value: "review_translation", label: "翻訳レビュー" },
    { value: "review_footnote", label: "脚注レビュー" },
    { value: "approve_translation", label: "翻訳承認" },
    { value: "approve_footnote", label: "脚注承認" },
    { value: "publish_pack", label: "Pack公開" },
    { value: "manage_rights", label: "Rights管理" },
    { value: "moderate_proposals", label: "提案モデレーション" },
    { value: "commercial_use", label: "商用利用" },
];

const USAGE_OPTIONS: Array<{ value: RightsUsage; label: string }> = [
    { value: "free_view", label: "無料閲覧" },
    { value: "paid_view", label: "有料閲覧" },
    { value: "promotional", label: "プロモーション" },
    { value: "commercial_distribution", label: "商用配布" },
];

const PACK_TYPE_OPTIONS: Array<{ value: PackType; label: string }> = [
    { value: "TRANSLATION", label: "翻訳 Pack" },
    { value: "FOOTNOTE", label: "脚注 Pack" },
    { value: "COMMENTARY", label: "解説 Pack" },
    { value: "LEARNING", label: "学習 Pack" },
    { value: "ACCESSIBILITY", label: "アクセシビリティ Pack" },
];

const OPERATION_GUIDES: Array<{
    title: string;
    description: string;
    permissions: RightsPermission[];
    to: string;
    actionLabel: string;
}> = [
    {
        title: "Proposal受付・整理",
        description: "読者や翻訳者からの翻訳・脚注提案を受け取り、triage します。",
        permissions: ["propose_translation", "propose_footnote", "moderate_proposals"],
        to: "/proposals",
        actionLabel: "Proposal Queueへ",
    },
    {
        title: "翻訳レビュー・承認",
        description: "翻訳や脚注の review / approve を行い、Pack Draft に採用できる状態へ進めます。",
        permissions: ["review_translation", "review_footnote", "approve_translation", "approve_footnote"],
        to: "/proposals",
        actionLabel: "承認対象を見る",
    },
    {
        title: "Pack下書き・公開",
        description: "採用済み proposal を Pack Draft にまとめ、公開前の下書き・承認・export を進めます。",
        permissions: ["edit_translation", "publish_pack", "commercial_use"],
        to: "/pack-drafts",
        actionLabel: "Pack Draftsへ",
    },
];

const emptyForm = {
    subject_user_id: "",
    role: "translator" as RightsRole,
    permissions: ["edit_translation"] as RightsPermission[],
    series_id: "",
    episode_id: "",
    language: "",
    pack_id: "",
    territory: "",
    pack_type: "" as PackType | "",
    usage: [] as RightsUsage[],
    starts_at: "",
    ends_at: "",
    granted_by: "",
    notes: "",
};

function formatDate(value?: string) {
    return value ? new Date(value).toLocaleString("ja-JP") : "-";
}

function toIsoDate(value: string) {
    return value ? new Date(value).toISOString() : undefined;
}

function toggleValue<T extends string>(values: T[], value: T) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function scopeLabels(grant: RightsGrantRecord) {
    const labels = [];
    if (grant.scope.series_id) labels.push(`series: ${grant.scope.series_id}`);
    if (grant.scope.episode_id) labels.push(`episode: ${grant.scope.episode_id}`);
    if (grant.scope.language) labels.push(`language: ${grant.scope.language}`);
    if (grant.scope.pack_id) labels.push(`pack_id: ${grant.scope.pack_id}`);
    if (grant.scope.territory) labels.push(`territory: ${grant.scope.territory}`);
    if (grant.scope.usage?.length) labels.push(`usage: ${grant.scope.usage.join(", ")}`);
    return labels.length > 0 ? labels : ["全体スコープ"];
}

function hasAnyPermission(grant: RightsGrantRecord, permissions: RightsPermission[]) {
    return permissions.some((permission) => grant.permissions.includes(permission));
}

export default function RightsManager() {
    const [items, setItems] = useState<RightsGrantRecord[]>([]);
    const [status, setStatus] = useState<StatusFilter>("active");
    const [userId, setUserId] = useState("");
    const [seriesId, setSeriesId] = useState("");
    const [episodeId, setEpisodeId] = useState("");
    const [language, setLanguage] = useState("");
    const [packId, setPackId] = useState("");
    const [usage, setUsage] = useState<RightsUsage | "">("");
    const [permission, setPermission] = useState<RightsPermission | "">("");
    const [form, setForm] = useState(emptyForm);
    const [revokeTarget, setRevokeTarget] = useState<RightsGrantRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const apiFilters = useMemo(() => ({
        ...(userId.trim() && { userId: userId.trim() }),
        ...(seriesId.trim() && { seriesId: seriesId.trim() }),
        ...(permission && { permission }),
        includeRevoked: status !== "active",
    }), [permission, seriesId, status, userId]);

    const visibleItems = useMemo(() => items.filter((item) => {
        if (status === "active" && item.revoked_at) return false;
        if (status === "revoked" && !item.revoked_at) return false;
        if (episodeId.trim() && item.scope.episode_id !== episodeId.trim()) return false;
        if (language.trim() && item.scope.language !== language.trim()) return false;
        if (packId.trim() && item.scope.pack_id !== packId.trim()) return false;
        if (usage && !item.scope.usage?.includes(usage)) return false;
        return true;
    }), [episodeId, items, language, packId, status, usage]);

    const grantSummary = useMemo(() => ({
        active: items.filter((item) => !item.revoked_at).length,
        revoked: items.filter((item) => item.revoked_at).length,
    }), [items]);

    const operationSummaries = useMemo(() => OPERATION_GUIDES.map((guide) => ({
        ...guide,
        grantCount: items.filter((item) => !item.revoked_at && hasAnyPermission(item, guide.permissions)).length,
    })), [items]);

    const reload = () => {
        setLoading(true);
        setError("");
        listRightsGrants(apiFilters)
            .then(setItems)
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFilters]);

    const createGrant = async () => {
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const next = await createRightsGrant({
                subject_user_id: form.subject_user_id.trim(),
                role: form.role,
                permissions: form.permissions,
                scope: {
                    ...(form.series_id.trim() && { series_id: form.series_id.trim() }),
                    ...(form.episode_id.trim() && { episode_id: form.episode_id.trim() }),
                    ...(form.language.trim() && { language: form.language.trim() }),
                    ...(form.pack_id.trim() && { pack_id: form.pack_id.trim() }),
                    ...(form.territory.trim() && { territory: form.territory.trim() }),
                    ...(form.usage.length > 0 && { usage: form.usage }),
                },
                ...(toIsoDate(form.starts_at) && { starts_at: toIsoDate(form.starts_at) }),
                ...(toIsoDate(form.ends_at) && { ends_at: toIsoDate(form.ends_at) }),
                ...(form.granted_by.trim() && { granted_by: form.granted_by.trim() }),
                ...(form.notes.trim() && { notes: form.notes.trim() }),
            });
            setItems((current) => [next, ...current.filter((item) => item.grant_id !== next.grant_id)]);
            setForm(emptyForm);
            setMessage(`${next.subject_user_id} に ${next.role} grant を作成しました。`);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const revokeGrant = async (grantId: string) => {
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const next = await revokeRightsGrant(grantId);
            setItems((current) => current.map((item) => item.grant_id === grantId ? next : item));
            setRevokeTarget(null);
            setMessage(`${next.subject_user_id} の grant を revoke しました。`);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const resetFilters = () => {
        setStatus("active");
        setUserId("");
        setSeriesId("");
        setEpisodeId("");
        setLanguage("");
        setPackId("");
        setUsage("");
        setPermission("");
    };

    return (
        <div className="rights-manager">
            <div className="section-heading rights-heading">
                <div>
                    <h1>Rights / Role Manager</h1>
                    <p className="card-meta">
                        閲覧 Entitlement とは別に、翻訳・レビュー・Pack公開・商用利用などの production rights grant を管理します。MVP scope は series / episode / language / Pack / usage に限定します。
                    </p>
                </div>
                <div className="rights-filters">
                    <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="status filter">
                        <option value="active">有効のみ</option>
                        <option value="revoked">revoke済み</option>
                        <option value="all">すべて</option>
                    </select>
                    <select value={permission} onChange={(e) => setPermission(e.target.value as RightsPermission | "")} aria-label="permission filter">
                        <option value="">permission すべて</option>
                        {PERMISSION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <button type="button" className="btn btn-outline btn-compact" onClick={reload}>再読み込み</button>
                </div>
            </div>

            <div className="rights-summary-row">
                <div className="rights-summary-item">
                    <span>表示中</span>
                    <strong>{visibleItems.length}</strong>
                </div>
                <div className="rights-summary-item">
                    <span>有効</span>
                    <strong>{grantSummary.active}</strong>
                </div>
                <div className="rights-summary-item">
                    <span>revoke済み</span>
                    <strong>{grantSummary.revoked}</strong>
                </div>
            </div>

            <section className="rights-operation-section">
                <div className="rights-list-heading">
                    <div>
                        <h2>Pack / Proposal 運用導線</h2>
                        <p className="card-meta">ここでは権限 enforcement は行わず、grant と運用画面の関係を確認するための導線だけを表示します。</p>
                    </div>
                    <span className="badge badge-muted">enforcement 未実装</span>
                </div>
                <div className="rights-operation-grid">
                    {operationSummaries.map((guide) => (
                        <article key={guide.title} className="card rights-operation-card">
                            <div>
                                <div className="rights-operation-header">
                                    <h3>{guide.title}</h3>
                                    <span className="badge badge-muted">{guide.grantCount} active grants</span>
                                </div>
                                <p className="card-meta">{guide.description}</p>
                            </div>
                            <div className="rights-permission-list">
                                {guide.permissions.map((guidePermission) => {
                                    const label = PERMISSION_OPTIONS.find((option) => option.value === guidePermission)?.label ?? guidePermission;
                                    return (
                                        <button
                                            key={guidePermission}
                                            type="button"
                                            className="rights-permission-chip rights-permission-button"
                                            onClick={() => setPermission(guidePermission)}
                                        >
                                            {label}<code>{guidePermission}</code>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="section-actions">
                                <Link to={guide.to} className="btn btn-outline btn-compact">{guide.actionLabel}</Link>
                                <button
                                    type="button"
                                    className="btn btn-outline btn-compact"
                                    onClick={() => setPermission(guide.permissions[0])}
                                >
                                    関連grantを絞り込み
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
                <div className="rights-contract-note">
                    <strong>contract note</strong>
                    <span>pack_type は UI 上の設計対象ですが、現行 RightsScope API は pack_id までです。pack_type を永続化するには API / schema contract 更新が必要です。</span>
                </div>
            </section>

            <section className="card rights-filter-card">
                <div className="rights-card-title-row">
                    <div>
                        <h2>一覧フィルタ</h2>
                        <p className="card-meta">user / series は API で絞り込み、episode / language / Pack / usage は画面内で絞り込みます。</p>
                    </div>
                    <button type="button" className="btn btn-outline btn-compact" onClick={resetFilters}>条件をクリア</button>
                </div>
                <div className="rights-filter-grid">
                    <div className="form-group">
                        <label>user id</label>
                        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="subject user id" />
                    </div>
                    <div className="form-group">
                        <label>series id</label>
                        <input value={seriesId} onChange={(e) => setSeriesId(e.target.value)} placeholder="rain-world" />
                    </div>
                    <div className="form-group">
                        <label>episode id</label>
                        <input value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} placeholder="ep01" />
                    </div>
                    <div className="form-group">
                        <label>language</label>
                        <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="ja / en" />
                    </div>
                    <div className="form-group">
                        <label>pack id</label>
                        <input value={packId} onChange={(e) => setPackId(e.target.value)} placeholder="pack id" />
                    </div>
                    <div className="form-group">
                        <label>usage</label>
                        <select value={usage} onChange={(e) => setUsage(e.target.value as RightsUsage | "")}>
                            <option value="">usage すべて</option>
                            {USAGE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {error && <div className="error-msg">{error}</div>}
            {message && <div className="success-msg">{message}</div>}

            <section className="rights-list-section">
                <div className="rights-list-heading">
                    <div>
                        <h2>grant 一覧</h2>
                        <p className="card-meta">対象、role、scope、permission を確認してから revoke します。</p>
                    </div>
                    <span className="card-meta">{visibleItems.length} / {items.length} 件表示</span>
                </div>

                {loading ? (
                    <p style={{ color: "var(--muted)" }}>読み込み中...</p>
                ) : visibleItems.length === 0 ? (
                    <div className="card empty-state">条件に一致する rights grant はありません。</div>
                ) : (
                    <div className="rights-list">
                        {visibleItems.map((item) => (
                            <article key={item.grant_id} className="card rights-card">
                                <div className="rights-card-header">
                                    <div>
                                        <div className="rights-title-row">
                                            <strong>{item.subject_user_id}</strong>
                                            <span className="rights-role">{item.role}</span>
                                        </div>
                                        <div className="identity-meta">
                                            <code>{item.grant_id}</code>
                                            <span>作成: {formatDate(item.created_at)}</span>
                                            <span>更新: {formatDate(item.updated_at)}</span>
                                            {item.granted_by && <span>付与者: {item.granted_by}</span>}
                                        </div>
                                    </div>
                                    <span className={`badge ${item.revoked_at ? "badge-muted" : "badge-ok"}`}>
                                        {item.revoked_at ? "revoke済み" : "有効"}
                                    </span>
                                </div>

                                <div className="rights-chip-row" aria-label="scope">
                                    {scopeLabels(item).map((label) => (
                                        <span key={label} className="rights-chip">{label}</span>
                                    ))}
                                </div>

                                <div className="rights-permission-list">
                                    {item.permissions.map((itemPermission) => {
                                        const label = PERMISSION_OPTIONS.find((option) => option.value === itemPermission)?.label ?? itemPermission;
                                        return <span key={itemPermission} className="rights-permission-chip">{label}<code>{itemPermission}</code></span>;
                                    })}
                                </div>

                                <dl className="detail-list rights-detail-list">
                                    <dt>開始</dt>
                                    <dd>{formatDate(item.starts_at)}</dd>
                                    <dt>終了</dt>
                                    <dd>{formatDate(item.ends_at)}</dd>
                                    <dt>revoke日時</dt>
                                    <dd>{formatDate(item.revoked_at)}</dd>
                                    {item.notes && (
                                        <>
                                            <dt>メモ</dt>
                                            <dd>{item.notes}</dd>
                                        </>
                                    )}
                                </dl>

                                {OPERATION_GUIDES.some((guide) => hasAnyPermission(item, guide.permissions)) && (
                                    <div className="rights-grant-actions">
                                        <span>運用導線</span>
                                        {OPERATION_GUIDES.filter((guide) => hasAnyPermission(item, guide.permissions)).map((guide) => (
                                            <Link key={guide.title} to={guide.to} className="btn btn-outline btn-compact">
                                                {guide.title}
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                {!item.revoked_at && (
                                    revokeTarget?.grant_id === item.grant_id ? (
                                        <div className="rights-revoke-confirm">
                                            <div>
                                                <strong>この grant を revoke しますか？</strong>
                                                <p className="card-meta">revoke 後は一覧に revoke済みとして残ります。</p>
                                            </div>
                                            <div className="section-actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline btn-compact danger-lite-inline"
                                                    disabled={saving}
                                                    onClick={() => revokeGrant(item.grant_id)}
                                                >
                                                    {saving ? "revoke中..." : "revokeを確定"}
                                                </button>
                                                <button type="button" className="btn btn-outline btn-compact" onClick={() => setRevokeTarget(null)}>
                                                    キャンセル
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="section-actions">
                                            <button
                                                type="button"
                                                className="btn btn-outline btn-compact danger-lite-inline"
                                                disabled={saving}
                                                onClick={() => setRevokeTarget(item)}
                                            >
                                                revoke
                                            </button>
                                        </div>
                                    )
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className="card rights-create-card">
                <div className="rights-card-title-row">
                    <div>
                        <h2>新規 grant 作成</h2>
                        <p className="card-meta">1. 対象と role、2. permission、3. scope の順に指定します。</p>
                    </div>
                    <span className="badge badge-muted">作成後は一覧に追加</span>
                </div>

                <div className="rights-step">
                    <div className="rights-step-heading">
                        <span>1</span>
                        <strong>対象と role</strong>
                    </div>
                    <div className="rights-create-grid">
                    <div className="form-group">
                        <label>subject user id</label>
                        <input
                            value={form.subject_user_id}
                            onChange={(e) => setForm((current) => ({ ...current, subject_user_id: e.target.value }))}
                            placeholder="user-123"
                        />
                    </div>
                    <div className="form-group">
                        <label>role</label>
                        <select value={form.role} onChange={(e) => setForm((current) => ({ ...current, role: e.target.value as RightsRole }))}>
                            {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>granted by</label>
                        <input
                            value={form.granted_by}
                            onChange={(e) => setForm((current) => ({ ...current, granted_by: e.target.value }))}
                            placeholder="任意"
                        />
                    </div>
                    </div>
                </div>

                <div className="rights-step">
                    <div className="rights-step-heading">
                        <span>2</span>
                        <strong>permission</strong>
                    </div>
                    <div className="rights-checkbox-grid">
                        {PERMISSION_OPTIONS.map((option) => (
                            <label key={option.value} className="rights-checkbox">
                                <input
                                    type="checkbox"
                                    checked={form.permissions.includes(option.value)}
                                    onChange={() => setForm((current) => ({
                                        ...current,
                                        permissions: toggleValue(current.permissions, option.value),
                                    }))}
                                />
                                <span>{option.label}</span>
                                <code>{option.value}</code>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="rights-step">
                    <div className="rights-step-heading">
                        <span>3</span>
                        <strong>scope</strong>
                    </div>
                    <div className="rights-create-grid">
                    <div className="form-group">
                        <label>series id</label>
                        <input value={form.series_id} onChange={(e) => setForm((current) => ({ ...current, series_id: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>episode id</label>
                        <input value={form.episode_id} onChange={(e) => setForm((current) => ({ ...current, episode_id: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>language</label>
                        <input value={form.language} onChange={(e) => setForm((current) => ({ ...current, language: e.target.value }))} placeholder="en" />
                    </div>
                    <div className="form-group">
                        <label>pack id</label>
                        <input value={form.pack_id} onChange={(e) => setForm((current) => ({ ...current, pack_id: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>territory</label>
                        <input value={form.territory} onChange={(e) => setForm((current) => ({ ...current, territory: e.target.value }))} placeholder="worldwide / JP" />
                    </div>
                    <div className="form-group">
                        <label>pack_type</label>
                        <select value={form.pack_type} onChange={(e) => setForm((current) => ({ ...current, pack_type: e.target.value as PackType | "" }))}>
                            <option value="">API未対応のため送信しない</option>
                            {PACK_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <div className="field-help">現行 contract は pack_id のみ対応です。pack_type は contract 更新待ちです。</div>
                    </div>
                    <div className="form-group">
                        <label>starts at</label>
                        <input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((current) => ({ ...current, starts_at: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label>ends at</label>
                        <input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((current) => ({ ...current, ends_at: e.target.value }))} />
                    </div>
                    <div className="form-group rights-notes-field">
                        <label>notes</label>
                        <textarea value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} placeholder="契約・確認元・運用メモ" />
                    </div>
                    </div>

                    <label className="rights-group-label">usage scope</label>
                    <div className="rights-usage-row">
                        {USAGE_OPTIONS.map((option) => (
                            <label key={option.value} className="rights-checkbox rights-checkbox-inline">
                                <input
                                    type="checkbox"
                                    checked={form.usage.includes(option.value)}
                                    onChange={() => setForm((current) => ({
                                        ...current,
                                        usage: toggleValue(current.usage, option.value),
                                    }))}
                                />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="section-actions">
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving || !form.subject_user_id.trim() || form.permissions.length === 0}
                        onClick={createGrant}
                    >
                        {saving ? "作成中..." : "grant を作成"}
                    </button>
                </div>
            </section>
        </div>
    );
}
