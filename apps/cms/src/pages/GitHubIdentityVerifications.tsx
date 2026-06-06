import { useEffect, useMemo, useState } from "react";
import {
    createGitHubIdentityVerification,
    listGitHubIdentityVerifications,
    revokeGitHubIdentityVerification,
    type GitHubIdentityVerificationRecord,
    type GitHubIdentityVerificationStatus,
} from "../api";

const STATUS_LABEL: Record<GitHubIdentityVerificationStatus, string> = {
    active: "有効",
    revoked: "取り消し済み",
};

const STATUS_CLASS: Record<GitHubIdentityVerificationStatus, string> = {
    active: "badge-ok",
    revoked: "badge-muted",
};

function formatDate(value?: string) {
    return value ? new Date(value).toLocaleString("ja-JP") : "-";
}

export default function GitHubIdentityVerifications() {
    const [items, setItems] = useState<GitHubIdentityVerificationRecord[]>([]);
    const [status, setStatus] = useState<GitHubIdentityVerificationStatus | "all">("active");
    const [githubLogin, setGithubLogin] = useState("");
    const [subjectUserId, setSubjectUserId] = useState("");
    const [form, setForm] = useState({
        github_login: "",
        github_user_id: "",
        subject_user_id: "",
        note: "",
    });
    const [revokeId, setRevokeId] = useState("");
    const [revokeNote, setRevokeNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const filters = useMemo(() => ({
        ...(status !== "all" && { status }),
        ...(githubLogin.trim() && { githubLogin: githubLogin.trim() }),
        ...(subjectUserId.trim() && { subjectUserId: subjectUserId.trim() }),
    }), [githubLogin, status, subjectUserId]);

    const reload = () => {
        setLoading(true);
        setError("");
        listGitHubIdentityVerifications(filters)
            .then(setItems)
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const createTrustedAdminRecord = async () => {
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const next = await createGitHubIdentityVerification({
                github_login: form.github_login.trim(),
                ...(form.github_user_id.trim() && { github_user_id: form.github_user_id.trim() }),
                ...(form.subject_user_id.trim() && { subject_user_id: form.subject_user_id.trim() }),
                ...(form.note.trim() && { note: form.note.trim() }),
            });
            setItems((current) => [next, ...current.filter((item) => item.verification_id !== next.verification_id)]);
            setForm({ github_login: "", github_user_id: "", subject_user_id: "", note: "" });
            setMessage(`@${next.github_login} を trusted admin verification として作成しました。`);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const revokeRecord = async (verificationId: string) => {
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const next = await revokeGitHubIdentityVerification(verificationId, {
                ...(revokeNote.trim() && { revoke_note: revokeNote.trim() }),
            });
            setItems((current) => current.map((item) => item.verification_id === verificationId ? next : item));
            setRevokeId("");
            setRevokeNote("");
            setMessage(`@${next.github_login} の verification を取り消しました。`);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="github-identities">
            <div className="section-heading">
                <div>
                    <h1>GitHub verified identity</h1>
                    <p className="card-meta">
                        GitHub login を verified contributor identity として管理します。trusted admin 作成は GitHub API を呼ばず、管理者が確認済みとして記録します。
                    </p>
                </div>
                <div className="identity-filters">
                    <select value={status} onChange={(e) => setStatus(e.target.value as GitHubIdentityVerificationStatus | "all")} aria-label="status filter">
                        <option value="active">有効</option>
                        <option value="revoked">取り消し済み</option>
                        <option value="all">すべて</option>
                    </select>
                    <input value={githubLogin} onChange={(e) => setGithubLogin(e.target.value)} placeholder="github login filter" />
                    <input value={subjectUserId} onChange={(e) => setSubjectUserId(e.target.value)} placeholder="subject user id filter" />
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {message && <div className="success-msg">{message}</div>}

            <section className="card identity-create-card">
                <div>
                    <h2>trusted admin 作成</h2>
                    <p className="card-meta">OAuth が未接続の間、管理者確認済みの GitHub login を active verification として登録します。</p>
                </div>
                <div className="identity-create-grid">
                    <div className="form-group">
                        <label>GitHub login</label>
                        <input
                            value={form.github_login}
                            onChange={(e) => setForm((current) => ({ ...current, github_login: e.target.value }))}
                            placeholder="octocat"
                        />
                    </div>
                    <div className="form-group">
                        <label>GitHub user id</label>
                        <input
                            value={form.github_user_id}
                            onChange={(e) => setForm((current) => ({ ...current, github_user_id: e.target.value }))}
                            placeholder="任意"
                        />
                    </div>
                    <div className="form-group">
                        <label>subject user id</label>
                        <input
                            value={form.subject_user_id}
                            onChange={(e) => setForm((current) => ({ ...current, subject_user_id: e.target.value }))}
                            placeholder="CMS / Reader user id（任意）"
                        />
                    </div>
                    <div className="form-group identity-create-note">
                        <label>確認メモ</label>
                        <textarea
                            value={form.note}
                            onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))}
                            placeholder="確認元、連絡経路、担当者メモ"
                        />
                    </div>
                </div>
                <div className="section-actions">
                    <button type="button" className="btn btn-primary" disabled={saving || !form.github_login.trim()} onClick={createTrustedAdminRecord}>
                        {saving ? "作成中..." : "trusted admin verification を作成"}
                    </button>
                </div>
            </section>

            {loading ? (
                <p style={{ color: "var(--muted)" }}>読み込み中...</p>
            ) : items.length === 0 ? (
                <div className="card empty-state">verification はありません。</div>
            ) : (
                <div className="identity-list">
                    {items.map((item) => (
                        <article key={item.verification_id} className="card identity-card">
                            <div className="identity-card-header">
                                <div>
                                    <div className="identity-login">@{item.github_login}</div>
                                    <div className="identity-meta">
                                        <code>{item.verification_id}</code>
                                        <span>{item.verification_method}</span>
                                        {item.github_user_id && <span>github user id: {item.github_user_id}</span>}
                                        {item.subject_user_id && <span>subject: {item.subject_user_id}</span>}
                                    </div>
                                </div>
                                <span className={`badge ${STATUS_CLASS[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                            </div>

                            <dl className="detail-list identity-detail-list">
                                <dt>verified at</dt>
                                <dd>{formatDate(item.verified_at)}</dd>
                                <dt>verified by</dt>
                                <dd>{item.verified_by ?? "-"}</dd>
                                <dt>updated at</dt>
                                <dd>{formatDate(item.updated_at)}</dd>
                                <dt>contributor identity</dt>
                                <dd><code>{JSON.stringify(item.contributor_identity)}</code></dd>
                                {item.note && (
                                    <>
                                        <dt>note</dt>
                                        <dd>{item.note}</dd>
                                    </>
                                )}
                                {item.status === "revoked" && (
                                    <>
                                        <dt>revoked at</dt>
                                        <dd>{formatDate(item.revoked_at)}</dd>
                                        <dt>revoked by</dt>
                                        <dd>{item.revoked_by ?? "-"}</dd>
                                        <dt>revoke note</dt>
                                        <dd>{item.revoke_note ?? "-"}</dd>
                                    </>
                                )}
                            </dl>

                            {item.status === "active" && (
                                revokeId === item.verification_id ? (
                                    <div className="identity-revoke-panel">
                                        <div className="form-group">
                                            <label>revoke note</label>
                                            <textarea
                                                value={revokeNote}
                                                onChange={(e) => setRevokeNote(e.target.value)}
                                                placeholder="取り消し理由"
                                            />
                                        </div>
                                        <div className="section-actions">
                                            <button type="button" className="btn btn-outline danger-lite-inline" disabled={saving} onClick={() => revokeRecord(item.verification_id)}>
                                                {saving ? "取り消し中..." : "revokeする"}
                                            </button>
                                            <button type="button" className="btn btn-outline" onClick={() => {
                                                setRevokeId("");
                                                setRevokeNote("");
                                            }}>
                                                キャンセル
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="section-actions">
                                        <button type="button" className="btn btn-outline btn-compact danger-lite-inline" onClick={() => setRevokeId(item.verification_id)}>
                                            revoke
                                        </button>
                                    </div>
                                )
                            )}
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
