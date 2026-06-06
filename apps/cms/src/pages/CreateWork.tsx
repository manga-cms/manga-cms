import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    createSeries,
    type PublicationVisibility,
    type SeriesLifecycleStatus,
    type SeriesPublicationType,
} from "../api";
import { publicationInputPayload, type PublicationFormState } from "../publication";

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CreateWork() {
    const nav = useNavigate();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [publicationType, setPublicationType] = useState<SeriesPublicationType>("serial");
    const [lifecycleStatus, setLifecycleStatus] = useState<SeriesLifecycleStatus>("ongoing");
    const [publication, setPublication] = useState<PublicationFormState>({
        visibility: "public",
        publishStartAt: "",
        publishEndAt: "",
    });
    const [customId, setCustomId] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const seriesId = customId || slugify(title);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) { setError("タイトルを入力してください"); return; }
        if (!seriesId) { setError("IDが空です"); return; }

        setSaving(true);
        setError("");
        try {
            await createSeries({
                id: seriesId,
                title,
                description,
                publicationType,
                lifecycleStatus,
                status: lifecycleStatus,
                ...publicationInputPayload(publication),
            });
            nav(`/works/${seriesId}`);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <h1>新しい作品を作成</h1>
            <form onSubmit={handleSubmit} className="card" style={{ maxWidth: "32rem" }}>
                <div className="form-group">
                    <label>タイトル *</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Rain World" />
                </div>
                <div className="form-group">
                    <label>ID (slug)</label>
                    <input value={customId} onChange={(e) => setCustomId(e.target.value)} placeholder={slugify(title) || "auto-generated"} />
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        → contents/{seriesId || "…"}/series.json
                    </div>
                </div>
                <div className="form-group">
                    <label>説明</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="作品の概要…" />
                </div>
                <div className="form-group">
                    <label>作品種別</label>
                    <select value={publicationType} onChange={(e) => setPublicationType(e.target.value as SeriesPublicationType)}>
                        <option value="serial">連載</option>
                        <option value="oneshot">読切</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>制作状態</label>
                    <select value={lifecycleStatus} onChange={(e) => setLifecycleStatus(e.target.value as SeriesLifecycleStatus)}>
                        <option value="ongoing">連載中</option>
                        <option value="completed">完結</option>
                        <option value="hiatus">休載</option>
                    </select>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        legacy status は lifecycleStatus と同じ値で保存します。
                    </div>
                </div>
                <div className="publication-grid">
                    <div className="form-group">
                        <label>Visibility</label>
                        <select
                            value={publication.visibility}
                            onChange={(e) => setPublication((current) => ({ ...current, visibility: e.target.value as PublicationVisibility }))}
                        >
                            <option value="public">Public</option>
                            <option value="hidden">Hidden</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Publish Start</label>
                        <input
                            type="datetime-local"
                            value={publication.publishStartAt}
                            onChange={(e) => setPublication((current) => ({ ...current, publishStartAt: e.target.value }))}
                        />
                    </div>
                    <div className="form-group">
                        <label>Publish End</label>
                        <input
                            type="datetime-local"
                            value={publication.publishEndAt}
                            onChange={(e) => setPublication((current) => ({ ...current, publishEndAt: e.target.value }))}
                        />
                    </div>
                </div>

                {error && <div className="error-msg">{error}</div>}

                <div className="section-actions">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "保存中…" : "作品を作成"}
                    </button>
                </div>
            </form>
        </div>
    );
}
