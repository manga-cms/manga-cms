import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    createPackDraft,
    listPackDrafts,
    type PackDraftRecord,
    type PackDraftStatus,
    type PackType,
} from "../api";

const STATUS_CLASS: Record<PackDraftStatus, string> = {
    draft: "badge-warn",
    in_review: "",
    approved: "badge-ok",
    published: "badge-ok",
    archived: "badge-muted",
};

const PACK_TYPES: PackType[] = ["TRANSLATION", "FOOTNOTE", "COMMENTARY", "LEARNING", "ACCESSIBILITY"];
const PACK_STATUSES: PackDraftStatus[] = ["draft", "in_review", "approved", "published", "archived"];

export default function PackDraftList() {
    const navigate = useNavigate();
    const [items, setItems] = useState<PackDraftRecord[]>([]);
    const [status, setStatus] = useState<PackDraftStatus | "all">("draft");
    const [type, setType] = useState<PackType | "all">("all");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        title: "",
        type: "TRANSLATION" as PackType,
        language: "en",
        target_series_id: "",
        target_episode_id: "",
        version: "1",
    });

    useEffect(() => {
        setLoading(true);
        setError("");
        listPackDrafts({
            ...(status !== "all" && { status }),
            ...(type !== "all" && { type }),
        })
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [status, type]);

    const create = async () => {
        setSaving(true);
        setError("");
        try {
            const next = await createPackDraft({
                title: form.title.trim(),
                type: form.type,
                ...(form.language.trim() && { language: form.language.trim() }),
                ...(form.target_series_id.trim() && { target_series_id: form.target_series_id.trim() }),
                ...(form.target_episode_id.trim() && { target_episode_id: form.target_episode_id.trim() }),
                ...(Number(form.version) > 0 && { version: Number(form.version) }),
            });
            navigate(`/pack-drafts/${next.pack_draft_id}`);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <div className="section-heading">
                <div>
                    <h1>Pack Drafts</h1>
                    <p className="card-meta">Draft, review, and adopt accepted proposals before canonical Pack export.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <select style={{ width: "11rem" }} value={status} onChange={(e) => setStatus(e.target.value as PackDraftStatus | "all")}>
                        {PACK_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
                        <option value="all">all</option>
                    </select>
                    <select style={{ width: "13rem" }} value={type} onChange={(e) => setType(e.target.value as PackType | "all")}>
                        <option value="all">all types</option>
                        {PACK_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <div className="grid-2">
                <div className="card">
                    <h2>Create Pack Draft</h2>
                    <div className="form-group">
                        <label>Title</label>
                        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Rain World English Translation" />
                    </div>
                    <div className="grid-2">
                        <div className="form-group">
                            <label>Type</label>
                            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PackType })}>
                                {PACK_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Language</label>
                            <input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} placeholder="en" />
                        </div>
                    </div>
                    <div className="grid-2">
                        <div className="form-group">
                            <label>Series ID</label>
                            <input value={form.target_series_id} onChange={(e) => setForm({ ...form, target_series_id: e.target.value })} placeholder="rain-world" />
                        </div>
                        <div className="form-group">
                            <label>Episode ID</label>
                            <input value={form.target_episode_id} onChange={(e) => setForm({ ...form, target_episode_id: e.target.value })} placeholder="ep01" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Version</label>
                        <input type="number" min="1" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
                    </div>
                    <button type="button" className="btn btn-primary" disabled={saving || !form.title.trim()} onClick={create}>
                        {saving ? "Creating..." : "Create Draft"}
                    </button>
                </div>

                <div>
                    {loading ? (
                        <p style={{ color: "var(--muted)" }}>Loading...</p>
                    ) : items.length === 0 ? (
                        <div className="card empty-state">Pack drafts are empty.</div>
                    ) : (
                        <div className="episode-list">
                            {items.map((item) => (
                                <Link key={item.pack_draft_id} to={`/pack-drafts/${item.pack_draft_id}`} className="card card-link">
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                                        <div>
                                            <div className="card-title">{item.title}</div>
                                            <div className="card-meta">
                                                {item.type} · {item.language ?? "-"} · v{item.version} · {item.entries.length} entries
                                            </div>
                                            <div className="card-meta">
                                                {item.target_series_id ?? "all series"} · {new Date(item.updated_at).toLocaleString("ja-JP")}
                                            </div>
                                        </div>
                                        <span className={`badge ${STATUS_CLASS[item.status]}`}>{item.status}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
