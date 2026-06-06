import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    createGitHubHandoffSyncAttempt,
    createGitHubTriageDraft,
    listGitHubHandoffSyncAttempts,
    listGitHubHandoffs,
    updateGitHubHandoffSyncAttemptStatus,
    updateGitHubHandoffStatus,
    type ContributorIdentity,
    type GitHubHandoffRecord,
    type GitHubHandoffSyncAttemptRecord,
    type GitHubHandoffSyncAttemptStatus,
    type GitHubHandoffSyncAttemptUpdateStatus,
    type GitHubHandoffStatus,
    type GitHubHandoffTargetType,
    type GitHubTriageDraft,
} from "../api";

const STATUS_CLASS: Record<GitHubHandoffStatus, string> = {
    queued: "badge-warn",
    ready: "",
    sent: "badge-ok",
    failed: "badge-err",
    canceled: "badge-muted",
};

const STATUS_LABEL: Record<GitHubHandoffStatus, string> = {
    queued: "未整理",
    ready: "Issue作成準備OK",
    sent: "送信済み",
    failed: "失敗",
    canceled: "キャンセル",
};

const TARGET_LABEL: Record<GitHubHandoffTargetType, string> = {
    feedback: "フィードバック",
    proposal: "提案",
};

const STATUS_HELP: Record<GitHubHandoffStatus, string> = {
    queued: "まず内容を確認し、Issue化するものは ready にします。",
    ready: "Issue title/body をコピーして GitHub に作成できます。",
    sent: "GitHub URL が登録された完了状態です。",
    failed: "送信失敗や保留理由を error message に残します。",
    canceled: "今回は GitHub に渡さないものです。",
};

const SYNC_ATTEMPT_STATUS_CLASS: Record<GitHubHandoffSyncAttemptStatus, string> = {
    planned: "badge-warn",
    in_progress: "",
    succeeded: "badge-ok",
    retryable_failed: "badge-warn",
    permanent_failed: "badge-err",
    canceled: "badge-muted",
};

const SYNC_ATTEMPT_STATUS_LABEL: Record<GitHubHandoffSyncAttemptStatus, string> = {
    planned: "planned",
    in_progress: "in progress",
    succeeded: "succeeded",
    retryable_failed: "retryable failed",
    permanent_failed: "permanent failed",
    canceled: "canceled",
};

const SYNC_ATTEMPT_UPDATE_STATUSES: GitHubHandoffSyncAttemptUpdateStatus[] = [
    "in_progress",
    "succeeded",
    "retryable_failed",
    "permanent_failed",
    "canceled",
];

type PreflightCheckState = "ok" | "warn" | "blocked";

interface PreflightCheck {
    key: string;
    label: string;
    state: PreflightCheckState;
    value: string;
    detail?: string;
}

interface HandoffDraftMetadata {
    handoffId: string;
    contributorIdentity?: ContributorIdentity;
}

function identityLabel(identity?: ContributorIdentity) {
    if (!identity || identity.identity_level === "anonymous") return "匿名";
    if (identity.identity_level === "display_name") return `${identity.display_name}（未検証）`;
    return `@${identity.github_login}（検証済み）`;
}

function formatDate(value?: string) {
    return value ? new Date(value).toLocaleString("ja-JP") : "-";
}

function targetLink(item: GitHubHandoffRecord) {
    if (item.target_type === "feedback") return `/feedback/${item.target_id}`;
    return `/proposals/${item.target_id}`;
}

function draftIds(draft: GitHubTriageDraft | null) {
    return new Set(draft?.handoff_ids ?? []);
}

function toggleSyncStatus(values: Array<"queued" | "ready">, value: "queued" | "ready") {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function toIsoDate(value: string) {
    return value ? new Date(value).toISOString() : undefined;
}

async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseContributorIdentity(value: unknown): ContributorIdentity | undefined {
    if (!isRecord(value)) return undefined;
    if (value.identity_level === "anonymous") return { identity_level: "anonymous" };
    if (value.identity_level === "display_name" && typeof value.display_name === "string") {
        return { identity_level: "display_name", display_name: value.display_name };
    }
    if (value.identity_level === "github_login" && typeof value.github_login === "string") {
        return {
            identity_level: "github_login",
            github_login: value.github_login,
            verified: true,
            ...(typeof value.github_user_id === "string" && { github_user_id: value.github_user_id }),
        };
    }
    return undefined;
}

function parseDraftMetadata(issueBody: string): HandoffDraftMetadata[] {
    const matches = issueBody.matchAll(/<!-- manga-cms-github-handoff\s*([\s\S]*?)\s*-->/g);
    return [...matches].flatMap((match) => {
        try {
            const parsed = JSON.parse(match[1]) as unknown;
            if (!isRecord(parsed) || typeof parsed.handoffId !== "string") return [];
            return [{
                handoffId: parsed.handoffId,
                contributorIdentity: parseContributorIdentity(parsed.contributorIdentity),
            }];
        } catch {
            return [];
        }
    });
}

function preflightStateLabel(state: PreflightCheckState) {
    if (state === "ok") return "OK";
    if (state === "warn") return "要確認";
    return "要対応";
}

function preflightStateClass(state: PreflightCheckState) {
    if (state === "ok") return "badge-ok";
    if (state === "warn") return "badge-warn";
    return "badge-err";
}

function isFutureDate(value?: string) {
    return value ? new Date(value).getTime() > Date.now() : false;
}

function buildPreflightChecks(attempt: GitHubHandoffSyncAttemptRecord): PreflightCheck[] {
    const draftMetadata = parseDraftMetadata(attempt.draft.issue_body);
    const identitiesById = new Map(draftMetadata.map((item) => [item.handoffId, item.contributorIdentity]));
    const missingMetadataCount = attempt.handoff_ids.filter((id) => !identitiesById.has(id)).length;
    const identityLabels = attempt.handoff_ids.map((id) => {
        const identity = identitiesById.get(id);
        return identity ? `${id}: ${identityLabel(identity)}` : `${id}: metadataなし`;
    });
    const hasFutureRateLimit = isFutureDate(attempt.rate_limit_reset_at);

    return [
        {
            key: "target_repository",
            label: "target_repository",
            state: attempt.target_repository ? "ok" : "blocked",
            value: attempt.target_repository || "未設定",
            detail: "投稿先 repository を確認します。",
        },
        {
            key: "target_issue",
            label: "target_issue",
            state: attempt.target_issue_number || attempt.issue_grouping_rule ? "ok" : "blocked",
            value: attempt.target_issue_number ? `#${attempt.target_issue_number}` : attempt.issue_grouping_rule ? `grouping: ${attempt.issue_grouping_rule}` : "未設定",
            detail: "Issue番号または grouping rule のどちらかが必要です。",
        },
        {
            key: "idempotency_key",
            label: "idempotency_key",
            state: attempt.idempotency_key ? "ok" : "blocked",
            value: attempt.idempotency_key || "未設定",
            detail: "重複投稿を避けるためのキーです。",
        },
        {
            key: "included_handoffs",
            label: "included handoffs",
            state: attempt.handoff_ids.length > 0 ? "ok" : "blocked",
            value: `${attempt.handoff_ids.length}件`,
            detail: attempt.handoff_ids.join(", ") || "handoff がありません。",
        },
        {
            key: "identity_level",
            label: "identity level",
            state: missingMetadataCount > 0 ? "warn" : "ok",
            value: missingMetadataCount > 0 ? `${missingMetadataCount}件の metadata を確認できません` : "draft metadata と一致",
            detail: identityLabels.join(" / ") || "identity metadata がありません。",
        },
        {
            key: "rate_limit_state",
            label: "rate limit state",
            state: hasFutureRateLimit ? "warn" : "ok",
            value: hasFutureRateLimit ? `reset: ${formatDate(attempt.rate_limit_reset_at)}` : "投稿待機なし",
            detail: attempt.next_retry_at
                ? `next_retry_at: ${formatDate(attempt.next_retry_at)}`
                : attempt.rate_limit_reset_at
                    ? `rate_limit_reset_at: ${formatDate(attempt.rate_limit_reset_at)}`
                    : "rate limit reset は記録されていません。",
        },
    ];
}

export default function GitHubHandoffList() {
    const [items, setItems] = useState<GitHubHandoffRecord[]>([]);
    const [attempts, setAttempts] = useState<GitHubHandoffSyncAttemptRecord[]>([]);
    const [status, setStatus] = useState<GitHubHandoffStatus | "all">("queued");
    const [targetType, setTargetType] = useState<GitHubHandoffTargetType | "all">("all");
    const [attemptStatus, setAttemptStatus] = useState<GitHubHandoffSyncAttemptStatus | "all">("all");
    const [attemptRepository, setAttemptRepository] = useState("");
    const [attemptEditingId, setAttemptEditingId] = useState("");
    const [attemptEditForm, setAttemptEditForm] = useState({
        status: "in_progress" as GitHubHandoffSyncAttemptUpdateStatus,
        attempt_count: "",
        github_url: "",
        last_error: "",
        next_retry_at: "",
        rate_limit_reset_at: "",
    });
    const [attemptForm, setAttemptForm] = useState({
        target_repository: "",
        target_issue_number: "",
        issue_grouping_rule: "",
        statuses: ["queued", "ready"] as Array<"queued" | "ready">,
        limit: "100",
        issue_title: "",
    });
    const [editingId, setEditingId] = useState("");
    const [nextStatus, setNextStatus] = useState<GitHubHandoffStatus>("queued");
    const [githubUrl, setGithubUrl] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [draft, setDraft] = useState<GitHubTriageDraft | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [drafting, setDrafting] = useState(false);
    const [copiedField, setCopiedField] = useState<"title" | "body" | "ids" | "">("");
    const [error, setError] = useState("");
    const [attemptError, setAttemptError] = useState("");
    const [attemptMessage, setAttemptMessage] = useState("");
    const [attemptsLoading, setAttemptsLoading] = useState(true);
    const [planningAttempt, setPlanningAttempt] = useState(false);
    const [updatingAttempt, setUpdatingAttempt] = useState(false);

    const filters = useMemo(() => ({
        ...(status !== "all" && { status }),
        ...(targetType !== "all" && { targetType }),
    }), [status, targetType]);
    const attemptFilters = useMemo(() => ({
        ...(attemptStatus !== "all" && { status: attemptStatus }),
        ...(attemptRepository.trim() && { targetRepository: attemptRepository.trim() }),
    }), [attemptRepository, attemptStatus]);
    const draftHandoffIds = useMemo(() => draftIds(draft), [draft]);

    const reload = () => {
        setLoading(true);
        setError("");
        listGitHubHandoffs(filters)
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const reloadAttempts = () => {
        setAttemptsLoading(true);
        setAttemptError("");
        listGitHubHandoffSyncAttempts(attemptFilters)
            .then(setAttempts)
            .catch((e) => setAttemptError((e as Error).message))
            .finally(() => setAttemptsLoading(false));
    };

    const reloadAttemptsForRepository = (targetRepository: string) => {
        setAttemptsLoading(true);
        setAttemptError("");
        listGitHubHandoffSyncAttempts({ targetRepository })
            .then(setAttempts)
            .catch((e) => setAttemptError((e as Error).message))
            .finally(() => setAttemptsLoading(false));
    };

    useEffect(() => {
        reloadAttempts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attemptFilters]);

    const startEdit = (item: GitHubHandoffRecord, statusOverride?: GitHubHandoffStatus) => {
        setEditingId(item.handoff_id);
        setNextStatus(statusOverride ?? item.status);
        setGithubUrl(item.github_url ?? "");
        setErrorMessage(item.error_message ?? "");
        setError("");
    };

    const saveStatus = async (handoffId: string) => {
        setSaving(true);
        setError("");
        try {
            const next = await updateGitHubHandoffStatus(handoffId, {
                status: nextStatus,
                ...(githubUrl.trim() && { github_url: githubUrl.trim() }),
                ...(errorMessage.trim() && { error_message: errorMessage.trim() }),
            });
            setItems((current) => current.map((item) => item.handoff_id === handoffId ? next : item));
            setEditingId("");
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const quickSaveStatus = async (item: GitHubHandoffRecord, next: GitHubHandoffStatus) => {
        if (next === "sent" || next === "failed") {
            startEdit(item, next);
            return;
        }
        setSaving(true);
        setError("");
        try {
            const updated = await updateGitHubHandoffStatus(item.handoff_id, { status: next });
            setItems((current) => current.map((handoff) => handoff.handoff_id === item.handoff_id ? updated : handoff));
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const generateDraft = async () => {
        setDrafting(true);
        setCopiedField("");
        setError("");
        try {
            const nextDraft = await createGitHubTriageDraft({
                status: status === "all" ? "queued" : status,
                ...(targetType !== "all" && { target_type: targetType }),
                limit: 100,
            });
            setDraft(nextDraft);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setDrafting(false);
        }
    };

    const createPlannedAttempt = async () => {
        const targetRepository = attemptForm.target_repository.trim();
        const targetIssueNumber = attemptForm.target_issue_number.trim();
        const issueGroupingRule = attemptForm.issue_grouping_rule.trim();
        setAttemptError("");
        setAttemptMessage("");

        if (!targetRepository) {
            setAttemptError("target_repository は必須です。owner/repo の形式で入力してください。");
            return;
        }
        if (!targetIssueNumber && !issueGroupingRule) {
            setAttemptError("target_issue_number または issue_grouping_rule のどちらかを入力してください。");
            return;
        }
        if (attemptForm.statuses.length === 0) {
            setAttemptError("queued または ready の少なくとも一方を選択してください。");
            return;
        }

        setPlanningAttempt(true);
        try {
            const result = await createGitHubHandoffSyncAttempt({
                target_repository: targetRepository,
                statuses: attemptForm.statuses,
                ...(targetType !== "all" && { target_type: targetType }),
                ...(targetIssueNumber && { target_issue_number: Number(targetIssueNumber) }),
                ...(issueGroupingRule && { issue_grouping_rule: issueGroupingRule }),
                ...(attemptForm.issue_title.trim() && { issue_title: attemptForm.issue_title.trim() }),
                ...(Number(attemptForm.limit) > 0 && { limit: Number(attemptForm.limit) }),
            });
            setAttemptStatus("all");
            setAttemptRepository(targetRepository);
            reloadAttemptsForRepository(targetRepository);
            setAttemptMessage(result.deduped
                ? `既存の planned attempt を表示しました: ${result.attempt.attempt_id}`
                : `planned attempt を作成しました: ${result.attempt.attempt_id}`);
        } catch (e) {
            setAttemptError((e as Error).message);
        } finally {
            setPlanningAttempt(false);
        }
    };

    const startAttemptEdit = (attempt: GitHubHandoffSyncAttemptRecord, statusOverride?: GitHubHandoffSyncAttemptUpdateStatus) => {
        setAttemptEditingId(attempt.attempt_id);
        setAttemptError("");
        setAttemptMessage("");
        setAttemptEditForm({
            status: statusOverride ?? (attempt.status === "planned" ? "in_progress" : attempt.status === "succeeded" ? "succeeded" : attempt.status),
            attempt_count: String(attempt.attempt_count),
            github_url: attempt.github_url ?? "",
            last_error: attempt.last_error ?? "",
            next_retry_at: "",
            rate_limit_reset_at: "",
        });
    };

    const saveAttemptStatus = async (attemptId: string) => {
        setAttemptError("");
        setAttemptMessage("");
        if (attemptEditForm.status === "succeeded" && !attemptEditForm.github_url.trim()) {
            setAttemptError("succeeded にする場合は github_url が必須です。");
            return;
        }
        setUpdatingAttempt(true);
        try {
            const updated = await updateGitHubHandoffSyncAttemptStatus(attemptId, {
                status: attemptEditForm.status,
                ...(attemptEditForm.attempt_count !== "" && { attempt_count: Number(attemptEditForm.attempt_count) }),
                ...(attemptEditForm.github_url.trim() && { github_url: attemptEditForm.github_url.trim() }),
                ...(attemptEditForm.last_error.trim() && { last_error: attemptEditForm.last_error.trim() }),
                ...(toIsoDate(attemptEditForm.next_retry_at) && { next_retry_at: toIsoDate(attemptEditForm.next_retry_at) }),
                ...(toIsoDate(attemptEditForm.rate_limit_reset_at) && { rate_limit_reset_at: toIsoDate(attemptEditForm.rate_limit_reset_at) }),
            });
            setAttempts((current) => current.map((attempt) => attempt.attempt_id === attemptId ? updated : attempt));
            setAttemptEditingId("");
            setAttemptMessage(`sync attempt を ${SYNC_ATTEMPT_STATUS_LABEL[updated.status]} に更新しました: ${updated.attempt_id}`);
        } catch (e) {
            setAttemptError((e as Error).message);
        } finally {
            setUpdatingAttempt(false);
        }
    };

    const copyDraftField = async (field: "title" | "body" | "ids") => {
        if (!draft) return;
        const value = field === "title"
            ? draft.issue_title
            : field === "body"
                ? draft.issue_body
                : draft.handoff_ids.join("\n");
        await copyText(value);
        setCopiedField(field);
    };

    return (
        <div className="github-handoffs">
            <div className="section-heading">
                <div>
                    <h1>GitHub Handoffs</h1>
                    <p className="card-meta">
                        GitHub に送る前の社内キューです。ここでは draft 生成と状態管理だけを行い、GitHub API は呼びません。
                    </p>
                </div>
                <div className="handoff-filters">
                    <select value={status} onChange={(e) => setStatus(e.target.value as GitHubHandoffStatus | "all")} aria-label="Status filter">
                        <option value="queued">未整理</option>
                        <option value="ready">Issue作成準備OK</option>
                        <option value="sent">送信済み</option>
                        <option value="failed">失敗</option>
                        <option value="canceled">キャンセル</option>
                        <option value="all">すべて</option>
                    </select>
                    <select value={targetType} onChange={(e) => setTargetType(e.target.value as GitHubHandoffTargetType | "all")} aria-label="Target filter">
                        <option value="all">対象すべて</option>
                        <option value="feedback">フィードバック</option>
                        <option value="proposal">提案</option>
                    </select>
                    <button type="button" className="btn btn-primary" disabled={drafting} onClick={generateDraft}>
                        {drafting ? "draft生成中..." : "triage draftを生成"}
                    </button>
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <section className="card sync-attempts-card">
                <div className="sync-attempts-header">
                    <div>
                        <h2>sync attempts</h2>
                        <p className="card-meta">
                            GitHub API 呼び出し前後の計画・再試行状態を確認します。planned attempt 作成は GitHub へ実投稿しません。
                        </p>
                    </div>
                    <div className="sync-attempt-filters">
                        <select value={attemptStatus} onChange={(e) => setAttemptStatus(e.target.value as GitHubHandoffSyncAttemptStatus | "all")} aria-label="Sync attempt status filter">
                            <option value="all">status すべて</option>
                            <option value="planned">planned</option>
                            <option value="in_progress">in progress</option>
                            <option value="succeeded">succeeded</option>
                            <option value="retryable_failed">retryable failed</option>
                            <option value="permanent_failed">permanent failed</option>
                            <option value="canceled">canceled</option>
                        </select>
                        <input
                            value={attemptRepository}
                            onChange={(e) => setAttemptRepository(e.target.value)}
                            placeholder="owner/repo"
                            aria-label="Target repository filter"
                        />
                        <button type="button" className="btn btn-outline btn-compact" onClick={reloadAttempts}>再読み込み</button>
                    </div>
                </div>

                {attemptError && <div className="error-msg">{attemptError}</div>}
                {attemptMessage && <div className="success-msg">{attemptMessage}</div>}

                <div className="sync-attempt-plan-panel">
                    <div>
                        <h3>planned attempt 作成</h3>
                        <p className="card-meta">現在の queued / ready handoff から dry-run を再計算し、runtime の sync attempt として保存します。</p>
                    </div>
                    <div className="sync-attempt-plan-grid">
                        <div className="form-group">
                            <label>target_repository</label>
                            <input
                                value={attemptForm.target_repository}
                                onChange={(e) => setAttemptForm((current) => ({ ...current, target_repository: e.target.value }))}
                                placeholder="owner/repo"
                            />
                        </div>
                        <div className="form-group">
                            <label>target_issue_number</label>
                            <input
                                type="number"
                                min="1"
                                value={attemptForm.target_issue_number}
                                onChange={(e) => setAttemptForm((current) => ({ ...current, target_issue_number: e.target.value }))}
                                placeholder="既存Issue番号"
                            />
                        </div>
                        <div className="form-group">
                            <label>issue_grouping_rule</label>
                            <input
                                value={attemptForm.issue_grouping_rule}
                                onChange={(e) => setAttemptForm((current) => ({ ...current, issue_grouping_rule: e.target.value }))}
                                placeholder="daily-triage など"
                            />
                        </div>
                        <div className="form-group">
                            <label>limit</label>
                            <input
                                type="number"
                                min="1"
                                max="200"
                                value={attemptForm.limit}
                                onChange={(e) => setAttemptForm((current) => ({ ...current, limit: e.target.value }))}
                            />
                        </div>
                        <div className="form-group sync-attempt-plan-title">
                            <label>issue_title（任意）</label>
                            <input
                                value={attemptForm.issue_title}
                                onChange={(e) => setAttemptForm((current) => ({ ...current, issue_title: e.target.value }))}
                                placeholder="GitHub issue title override"
                            />
                        </div>
                    </div>
                    <div className="sync-attempt-plan-footer">
                        <div className="sync-attempt-status-checks">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={attemptForm.statuses.includes("queued")}
                                    onChange={() => setAttemptForm((current) => ({ ...current, statuses: toggleSyncStatus(current.statuses, "queued") }))}
                                />
                                queued
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={attemptForm.statuses.includes("ready")}
                                    onChange={() => setAttemptForm((current) => ({ ...current, statuses: toggleSyncStatus(current.statuses, "ready") }))}
                                />
                                ready
                            </label>
                            {targetType !== "all" && <span className="card-meta">target filter: {targetType}</span>}
                        </div>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={planningAttempt || !attemptForm.target_repository.trim()}
                            onClick={createPlannedAttempt}
                        >
                            {planningAttempt ? "作成中..." : "planned attemptを作成"}
                        </button>
                    </div>
                </div>

                {attemptsLoading ? (
                    <p style={{ color: "var(--muted)" }}>sync attempts 読み込み中...</p>
                ) : attempts.length === 0 ? (
                    <div className="empty-state sync-attempt-empty">
                        sync attempt はまだありません。planned attempt 作成は後続で追加予定です。
                    </div>
                ) : (
                    <div className="sync-attempt-list">
                        {attempts.map((attempt) => {
                            const isAttemptEditing = attemptEditingId === attempt.attempt_id;
                            const preflightChecks = buildPreflightChecks(attempt);
                            const blockedCount = preflightChecks.filter((check) => check.state === "blocked").length;
                            const warningCount = preflightChecks.filter((check) => check.state === "warn").length;
                            return (
                                <article key={attempt.attempt_id} className="sync-attempt-row">
                                    <div className="sync-attempt-main">
                                        <div className="sync-attempt-title">
                                            <span className={`badge ${SYNC_ATTEMPT_STATUS_CLASS[attempt.status]}`}>
                                                {SYNC_ATTEMPT_STATUS_LABEL[attempt.status]}
                                            </span>
                                            <code>{attempt.attempt_id}</code>
                                        </div>
                                        <div className="handoff-meta-row">
                                            <span>repository: <strong>{attempt.target_repository}</strong></span>
                                            {attempt.target_issue_number && <span>issue: #{attempt.target_issue_number}</span>}
                                            {attempt.issue_grouping_rule && <span>grouping: {attempt.issue_grouping_rule}</span>}
                                            <span>updated: {formatDate(attempt.updated_at)}</span>
                                        </div>
                                        <dl className="detail-list sync-attempt-detail-list">
                                            <dt>handoff ids</dt>
                                            <dd>
                                                <div className="handoff-id-list sync-attempt-id-list">
                                                    {attempt.handoff_ids.map((id) => <code key={id}>{id}</code>)}
                                                </div>
                                            </dd>
                                            <dt>idempotency key</dt>
                                            <dd><code>{attempt.idempotency_key}</code></dd>
                                            <dt>attempts</dt>
                                            <dd>{attempt.attempt_count} / {attempt.max_attempts}</dd>
                                            <dt>last error</dt>
                                            <dd>{attempt.last_error ?? "-"}</dd>
                                        </dl>

                                        <div className="sync-preflight-panel" aria-label="実投稿前 safety checklist">
                                            <div className="sync-preflight-header">
                                                <div>
                                                    <strong>実投稿前 safety checklist</strong>
                                                    <p className="card-meta">
                                                        GitHub API は呼ばず、attempt に保存された preflight 情報だけを確認します。
                                                    </p>
                                                </div>
                                                <span className={`badge ${blockedCount > 0 ? "badge-err" : warningCount > 0 ? "badge-warn" : "badge-ok"}`}>
                                                    {blockedCount > 0 ? `${blockedCount}件 要対応` : warningCount > 0 ? `${warningCount}件 要確認` : "投稿前確認OK"}
                                                </span>
                                            </div>
                                            <div className="sync-preflight-grid">
                                                {preflightChecks.map((check) => (
                                                    <div key={check.key} className="sync-preflight-item">
                                                        <div className="sync-preflight-item-header">
                                                            <span>{check.label}</span>
                                                            <span className={`badge ${preflightStateClass(check.state)}`}>{preflightStateLabel(check.state)}</span>
                                                        </div>
                                                        <div className="sync-preflight-value">{check.value}</div>
                                                        {check.detail && <p>{check.detail}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {isAttemptEditing && (
                                            <div className="sync-attempt-edit-panel">
                                                <div className="form-group">
                                                    <label>次の lifecycle status</label>
                                                    <select
                                                        value={attemptEditForm.status}
                                                        onChange={(e) => setAttemptEditForm((current) => ({ ...current, status: e.target.value as GitHubHandoffSyncAttemptUpdateStatus }))}
                                                    >
                                                        {SYNC_ATTEMPT_UPDATE_STATUSES.map((value) => (
                                                            <option key={value} value={value}>{SYNC_ATTEMPT_STATUS_LABEL[value]}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label>attempt_count</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={attemptEditForm.attempt_count}
                                                        onChange={(e) => setAttemptEditForm((current) => ({ ...current, attempt_count: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="form-group sync-attempt-edit-url">
                                                    <label>github_url {attemptEditForm.status === "succeeded" ? "（必須）" : "（任意）"}</label>
                                                    <input
                                                        value={attemptEditForm.github_url}
                                                        onChange={(e) => setAttemptEditForm((current) => ({ ...current, github_url: e.target.value }))}
                                                        placeholder="https://github.com/owner/repo/issues/123"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>next_retry_at</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={attemptEditForm.next_retry_at}
                                                        onChange={(e) => setAttemptEditForm((current) => ({ ...current, next_retry_at: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>rate_limit_reset_at</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={attemptEditForm.rate_limit_reset_at}
                                                        onChange={(e) => setAttemptEditForm((current) => ({ ...current, rate_limit_reset_at: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="form-group sync-attempt-edit-error">
                                                    <label>last_error</label>
                                                    <textarea
                                                        value={attemptEditForm.last_error}
                                                        onChange={(e) => setAttemptEditForm((current) => ({ ...current, last_error: e.target.value }))}
                                                        placeholder="retryable/permanent failure の理由"
                                                    />
                                                </div>
                                                <div className="section-actions sync-attempt-edit-actions">
                                                    <button type="button" className="btn btn-primary" disabled={updatingAttempt} onClick={() => saveAttemptStatus(attempt.attempt_id)}>
                                                        {updatingAttempt ? "更新中..." : "statusを更新"}
                                                    </button>
                                                    <button type="button" className="btn btn-outline" onClick={() => setAttemptEditingId("")}>キャンセル</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="sync-attempt-actions">
                                        {attempt.github_url && (
                                            <a href={attempt.github_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-compact">
                                                GitHubを開く
                                            </a>
                                        )}
                                        {!isAttemptEditing && (
                                            <>
                                                {attempt.status === "planned" && (
                                                    <button type="button" className="btn btn-outline btn-compact" onClick={() => startAttemptEdit(attempt, "in_progress")}>
                                                        in progressへ
                                                    </button>
                                                )}
                                                {attempt.status === "in_progress" && (
                                                    <button type="button" className="btn btn-outline btn-compact" onClick={() => startAttemptEdit(attempt, "succeeded")}>
                                                        succeededへ
                                                    </button>
                                                )}
                                                <button type="button" className="btn btn-outline btn-compact" onClick={() => startAttemptEdit(attempt)}>
                                                    lifecycle編集
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            {draft && (
                <section className="card triage-draft-card">
                    <div className="triage-draft-header">
                        <div>
                            <h2>triage draft</h2>
                            <p className="card-meta">
                                {draft.items_count}件 · {new Date(draft.generated_at).toLocaleString("ja-JP")}
                                {draft.triage_group_key ? ` · group: ${draft.triage_group_key}` : ""}
                            </p>
                        </div>
                        <div className="section-actions">
                            <button type="button" className="btn btn-outline btn-compact" onClick={() => copyDraftField("title")}>
                                {copiedField === "title" ? "titleコピー済み" : "titleをコピー"}
                            </button>
                            <button type="button" className="btn btn-outline btn-compact" onClick={() => copyDraftField("body")}>
                                {copiedField === "body" ? "bodyコピー済み" : "bodyをコピー"}
                            </button>
                            <button type="button" className="btn btn-outline btn-compact" onClick={() => copyDraftField("ids")}>
                                {copiedField === "ids" ? "IDコピー済み" : "handoff idsをコピー"}
                            </button>
                        </div>
                    </div>

                    <div className="triage-draft-grid">
                        <div className="form-group">
                            <label>Issue title</label>
                            <input readOnly value={draft.issue_title} />
                        </div>
                        <div className="form-group">
                            <label>含まれる handoff ids</label>
                            <div className="handoff-id-list">
                                {draft.handoff_ids.map((id) => (
                                    <code key={id}>{id}</code>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Issue body</label>
                        <textarea readOnly value={draft.issue_body} rows={16} className="triage-draft-body" />
                    </div>
                </section>
            )}

            {loading ? (
                <p style={{ color: "var(--muted)" }}>読み込み中...</p>
            ) : items.length === 0 ? (
                <div className="card empty-state">GitHub handoff queue は空です。</div>
            ) : (
                <div className="episode-list">
                    {items.map((item) => {
                        const isEditing = editingId === item.handoff_id;
                        const isInDraft = draftHandoffIds.has(item.handoff_id);
                        return (
                            <article key={item.handoff_id} className={`card handoff-card ${isInDraft ? "is-in-draft" : ""}`}>
                                <div className="handoff-card-header">
                                    <div>
                                        <div className="card-title">
                                            {TARGET_LABEL[item.target_type]} · <Link to={targetLink(item)}>{item.target_id}</Link>
                                        </div>
                                        <div className="card-meta">
                                            {identityLabel(item.contributor_identity)} · {new Date(item.created_at).toLocaleString("ja-JP")}
                                        </div>
                                        <div className="handoff-meta-row">
                                            <code>{item.handoff_id}</code>
                                            <span>{item.mode}</span>
                                            {item.triage_group_key && <span>group: {item.triage_group_key}</span>}
                                            {isInDraft && <span className="badge">draft対象</span>}
                                        </div>
                                    </div>
                                    <div className="handoff-status">
                                        <span className={`badge ${STATUS_CLASS[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                                        <small>{STATUS_HELP[item.status]}</small>
                                    </div>
                                </div>

                                {item.title && <p className="handoff-title">{item.title}</p>}
                                {item.github_url && (
                                    <p className="handoff-link">
                                        <a href={item.github_url} target="_blank" rel="noreferrer">{item.github_url}</a>
                                    </p>
                                )}
                                {item.error_message && <p className="error-msg">{item.error_message}</p>}

                                {isEditing ? (
                                    <div className="handoff-edit-panel">
                                        <div className="form-group">
                                            <label>次の状態</label>
                                            <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as GitHubHandoffStatus)}>
                                                <option value="queued">未整理</option>
                                                <option value="ready">Issue作成準備OK</option>
                                                <option value="sent">送信済み</option>
                                                <option value="failed">失敗</option>
                                                <option value="canceled">キャンセル</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>GitHub URL（sent の時に記録）</label>
                                            <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/..." />
                                        </div>
                                        <div className="form-group handoff-edit-full">
                                            <label>Error message（failed の理由）</label>
                                            <textarea value={errorMessage} onChange={(e) => setErrorMessage(e.target.value)} placeholder="失敗理由や再試行メモ" />
                                        </div>
                                        <div className="section-actions handoff-edit-full">
                                            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => saveStatus(item.handoff_id)}>
                                                {saving ? "保存中..." : "状態を保存"}
                                            </button>
                                            <button type="button" className="btn btn-outline" onClick={() => setEditingId("")}>キャンセル</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="handoff-actions">
                                        {item.status === "queued" && (
                                            <button type="button" className="btn btn-outline btn-compact" disabled={saving} onClick={() => quickSaveStatus(item, "ready")}>
                                                readyにする
                                            </button>
                                        )}
                                        {(item.status === "queued" || item.status === "ready") && (
                                            <>
                                                <button type="button" className="btn btn-outline btn-compact" onClick={() => startEdit(item, "sent")}>
                                                    sentとして記録
                                                </button>
                                                <button type="button" className="btn btn-outline btn-compact danger-lite-inline" onClick={() => startEdit(item, "failed")}>
                                                    failedとして記録
                                                </button>
                                            </>
                                        )}
                                        <button type="button" className="btn btn-outline btn-compact" onClick={() => startEdit(item)}>
                                            詳細編集
                                        </button>
                                        <Link to={targetLink(item)} className="btn btn-outline btn-compact">対象を開く</Link>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
