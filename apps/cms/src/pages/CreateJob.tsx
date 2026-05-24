import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createJob, type DraftPayload } from "../api";

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CreateJob() {
    const nav = useNavigate();
    const [label, setLabel] = useState("");
    const [seriesTitle, setSeriesTitle] = useState("");
    const [seriesId, setSeriesId] = useState("");
    const [seriesDesc, setSeriesDesc] = useState("");
    const [epId, setEpId] = useState("ep01");
    const [epNum, setEpNum] = useState(1);
    const [epTitle, setEpTitle] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const autoSeriesId = seriesId || slugify(seriesTitle);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!seriesTitle.trim() || !epTitle.trim()) {
            setError("タイトルを入力してください");
            return;
        }

        const draft: DraftPayload = {
            seriesId: autoSeriesId,
            seriesTitle,
            seriesDescription: seriesDesc,
            seriesStatus: "ongoing",
            episodeId: epId,
            episodeNumber: epNum,
            episodeTitle: epTitle,
            pages: [
                { pageNumber: 1, imagePath: "pages/p01.jpg", width: 500, height: 760, panels: [] },
            ],
        };

        setSaving(true);
        setError("");
        try {
            const job = await createJob(label || `${seriesTitle} - ${epTitle}`, draft);
            nav(`/ingestion/${job.id}`);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <h1>新しい取り込みジョブ</h1>
            <form onSubmit={handleSubmit} style={{ maxWidth: "36rem" }}>
                <div className="card">
                    <h2>ジョブ情報</h2>
                    <div className="form-group">
                        <label>ラベル</label>
                        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="自動生成されます" />
                    </div>
                </div>

                <div className="card">
                    <h2>作品</h2>
                    <div className="form-group">
                        <label>作品タイトル *</label>
                        <input value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} placeholder="Rain World" />
                    </div>
                    <div className="form-group">
                        <label>作品 ID</label>
                        <input value={seriesId} onChange={(e) => setSeriesId(e.target.value)} placeholder={autoSeriesId || "auto"} />
                    </div>
                    <div className="form-group">
                        <label>説明</label>
                        <textarea value={seriesDesc} onChange={(e) => setSeriesDesc(e.target.value)} />
                    </div>
                </div>

                <div className="card">
                    <h2>エピソード</h2>
                    <div className="form-group">
                        <label>Episode ID</label>
                        <input value={epId} onChange={(e) => setEpId(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Episode Number</label>
                        <input type="number" min={1} value={epNum} onChange={(e) => setEpNum(Number(e.target.value))} />
                    </div>
                    <div className="form-group">
                        <label>エピソードタイトル *</label>
                        <input value={epTitle} onChange={(e) => setEpTitle(e.target.value)} placeholder="第1話 雨の始まり" />
                    </div>
                </div>

                {error && <div className="error-msg">{error}</div>}

                <div className="section-actions">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "作成中…" : "ジョブを作成（Draft）"}
                    </button>
                </div>
            </form>
        </div>
    );
}
