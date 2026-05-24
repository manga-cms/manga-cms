import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSeries } from "../api";

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CreateWork() {
    const nav = useNavigate();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState("ongoing");
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
            await createSeries({ id: seriesId, title, description, status });
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
                    <label>Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="ongoing">Ongoing</option>
                        <option value="completed">Completed</option>
                        <option value="hiatus">Hiatus</option>
                    </select>
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
