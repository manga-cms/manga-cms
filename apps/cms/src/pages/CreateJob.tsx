import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createJob, importPreparedDirectory, type DraftPayload, type PreparedDirectoryImportPageInput } from "../api";

function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parsePageManifest(text: string): PreparedDirectoryImportPageInput[] | undefined {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
        throw new Error("Page Manifest は JSON array で入力してください");
    }
    return parsed.map((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new Error(`Page Manifest ${index + 1} 行目が object ではありません`);
        }
        const sourcePath = typeof entry.sourcePath === "string" ? entry.sourcePath.trim() : undefined;
        const fileName = typeof entry.fileName === "string" ? entry.fileName.trim() : undefined;
        const pageNumber = entry.pageNumber === undefined ? undefined : Number(entry.pageNumber);
        const width = entry.width === undefined ? undefined : Number(entry.width);
        const height = entry.height === undefined ? undefined : Number(entry.height);
        const displayRef = typeof entry.displayRef === "string" ? entry.displayRef.trim() : undefined;

        if (!sourcePath && !fileName) {
            throw new Error(`Page Manifest ${index + 1} 行目に sourcePath または fileName が必要です`);
        }
        if (pageNumber !== undefined && (!Number.isInteger(pageNumber) || pageNumber < 1)) {
            throw new Error(`Page Manifest ${index + 1} 行目の pageNumber が不正です`);
        }
        if (width !== undefined && (!Number.isFinite(width) || width < 1)) {
            throw new Error(`Page Manifest ${index + 1} 行目の width が不正です`);
        }
        if (height !== undefined && (!Number.isFinite(height) || height < 1)) {
            throw new Error(`Page Manifest ${index + 1} 行目の height が不正です`);
        }

        return {
            ...(sourcePath ? { sourcePath } : {}),
            ...(fileName ? { fileName } : {}),
            ...(pageNumber !== undefined ? { pageNumber } : {}),
            ...(width !== undefined ? { width } : {}),
            ...(height !== undefined ? { height } : {}),
            ...(displayRef ? { displayRef } : {}),
        };
    });
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
    const [sourceDir, setSourceDir] = useState("");
    const [defaultWidth, setDefaultWidth] = useState(500);
    const [defaultHeight, setDefaultHeight] = useState(760);
    const [pageManifest, setPageManifest] = useState("");
    const [mode, setMode] = useState<"manual" | "prepared">("prepared");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const autoSeriesId = seriesId || slugify(seriesTitle);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!seriesTitle.trim() || !epTitle.trim()) {
            setError("タイトルを入力してください");
            return;
        }
        if (mode === "prepared" && !sourceDir.trim()) {
            setError("Source Directory を入力してください");
            return;
        }
        let pages: PreparedDirectoryImportPageInput[] | undefined;
        try {
            pages = mode === "prepared" ? parsePageManifest(pageManifest) : undefined;
        } catch (err) {
            setError((err as Error).message);
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
            const job = mode === "prepared"
                ? await importPreparedDirectory({
                    label: label || `${seriesTitle} - ${epTitle}`,
                    sourceDir,
                    seriesId: autoSeriesId,
                    seriesTitle,
                    seriesDescription: seriesDesc,
                    seriesStatus: "ongoing",
                    episodeId: epId,
                    episodeNumber: epNum,
                    episodeTitle: epTitle,
                    defaultWidth,
                    defaultHeight,
                    pages,
                })
                : await createJob(label || `${seriesTitle} - ${epTitle}`, draft);
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
                        <label>Import Mode</label>
                        <select value={mode} onChange={(e) => setMode(e.target.value as "manual" | "prepared")}>
                            <option value="prepared">Prepared directory</option>
                            <option value="manual">Manual draft stub</option>
                        </select>
                    </div>
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

                {mode === "prepared" && (
                    <div className="card">
                        <h2>Prepared Assets</h2>
                        <div className="form-group">
                            <label>Source Directory</label>
                            <input value={sourceDir} onChange={(e) => setSourceDir(e.target.value)} placeholder="rain-world/ep01/pages" />
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                                API server reads this path relative to IMPORTS_DIR. Supported files: jpg, png, webp, gif.
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Page Manifest JSON</label>
                            <textarea
                                value={pageManifest}
                                onChange={(e) => setPageManifest(e.target.value)}
                                placeholder={'[\n  { "sourcePath": "page-01.png", "pageNumber": 1, "displayRef": "P1" }\n]'}
                                rows={6}
                            />
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                                Optional. Leave empty to sort all supported images by filename. Use this for storyboard labels or explicit page order.
                            </div>
                        </div>
                        <div className="page-editor-grid">
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Default Width</label>
                                <input type="number" min={1} value={defaultWidth} onChange={(e) => setDefaultWidth(Number(e.target.value))} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Default Height</label>
                                <input type="number" min={1} value={defaultHeight} onChange={(e) => setDefaultHeight(Number(e.target.value))} />
                            </div>
                        </div>
                    </div>
                )}

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
