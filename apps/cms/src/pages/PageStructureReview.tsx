import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    getAdminEpisode,
    getAdminPageImageUrl,
    saveEpisode,
    type BoundingBox,
    type BubbleData,
    type EpisodeData,
    type PageData,
    type PanelData,
} from "../api";

type DragState = {
    kind: "panel" | "bubble";
    mode: "move" | "resize";
    panelIndex: number;
    bubbleIndex?: number;
    startX: number;
    startY: number;
    startBox: BoundingBox;
};

const MIN_BOX_SIZE = 18;
type PanelTemplate = "two-one-two" | "one-one-two" | "three-rows" | "six-plus-wide";

function pad(n: number) {
    return String(n).padStart(3, "0");
}

function clampBox(box: BoundingBox, page: PageData): BoundingBox {
    const width = Math.max(MIN_BOX_SIZE, Math.min(box.width, page.width));
    const height = Math.max(MIN_BOX_SIZE, Math.min(box.height, page.height));
    return {
        x: Math.max(0, Math.min(box.x, page.width - width)),
        y: Math.max(0, Math.min(box.y, page.height - height)),
        width,
        height,
    };
}

function toBoxStyle(box: BoundingBox, page: PageData) {
    return {
        left: `${(box.x / page.width) * 100}%`,
        top: `${(box.y / page.height) * 100}%`,
        width: `${(box.width / page.width) * 100}%`,
        height: `${(box.height / page.height) * 100}%`,
    };
}

function makePanelId(page: PageData, panelNumber: number) {
    return `${page.id}-k${pad(panelNumber)}`;
}

function makeBubbleId(panel: PanelData, bubbleNumber: number) {
    return `${panel.id}-f${pad(bubbleNumber)}`;
}

function makeBubbleShortId(page: PageData, panel: PanelData, bubbleNumber: number) {
    return `p${page.pageNumber}-k${panel.panelNumber}-f${bubbleNumber}`;
}

function templateBox(page: PageData, x: number, y: number, width: number, height: number): BoundingBox {
    return clampBox({
        x: Math.round(page.width * x),
        y: Math.round(page.height * y),
        width: Math.round(page.width * width),
        height: Math.round(page.height * height),
    }, page);
}

function makeTemplatePanel(page: PageData, panelNumber: number, bbox: BoundingBox): PanelData {
    return {
        id: makePanelId(page, panelNumber),
        panelNumber,
        bbox,
        reactionTags: [],
        bubbles: [],
    };
}

function buildTemplatePanels(page: PageData, template: PanelTemplate): PanelData[] {
    const boxesByReadingOrder: Record<PanelTemplate, BoundingBox[]> = {
        // Japanese reading order: right panel first, then left panel.
        "two-one-two": [
            templateBox(page, 0.52, 0.06, 0.42, 0.23),
            templateBox(page, 0.06, 0.06, 0.42, 0.23),
            templateBox(page, 0.06, 0.32, 0.88, 0.28),
            templateBox(page, 0.52, 0.63, 0.42, 0.30),
            templateBox(page, 0.06, 0.63, 0.42, 0.30),
        ],
        "one-one-two": [
            templateBox(page, 0.06, 0.06, 0.88, 0.28),
            templateBox(page, 0.06, 0.37, 0.88, 0.27),
            templateBox(page, 0.52, 0.67, 0.42, 0.27),
            templateBox(page, 0.06, 0.67, 0.42, 0.27),
        ],
        "three-rows": [
            templateBox(page, 0.06, 0.06, 0.88, 0.28),
            templateBox(page, 0.06, 0.37, 0.88, 0.27),
            templateBox(page, 0.06, 0.67, 0.88, 0.27),
        ],
        "six-plus-wide": [
            templateBox(page, 0.69, 0.06, 0.25, 0.28),
            templateBox(page, 0.375, 0.06, 0.25, 0.28),
            templateBox(page, 0.06, 0.06, 0.25, 0.28),
            templateBox(page, 0.69, 0.37, 0.25, 0.27),
            templateBox(page, 0.375, 0.37, 0.25, 0.27),
            templateBox(page, 0.06, 0.37, 0.25, 0.27),
            templateBox(page, 0.06, 0.67, 0.88, 0.27),
        ],
    };

    return boxesByReadingOrder[template].map((bbox, index) => makeTemplatePanel(page, index + 1, bbox));
}

function parseScriptAssistLines(text: string): { speaker?: string; textOriginal: string; bubbleType: BubbleData["bubbleType"] }[] {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const sfx = line.match(/^《(.+)》$/);
            if (sfx) {
                return { textOriginal: sfx[1], bubbleType: "sfx" as const };
            }

            const dialogue = line.match(/^(.+?)\s*[「“](.+)[」”]$/);
            if (dialogue) {
                return {
                    speaker: dialogue[1].trim(),
                    textOriginal: dialogue[2].trim(),
                    bubbleType: "speech" as const,
                };
            }

            return { textOriginal: line, bubbleType: "narration" as const };
        });
}

export default function PageStructureReview() {
    const { id: seriesId, epId } = useParams<{ id: string; epId: string }>();
    const nav = useNavigate();
    const canvasRef = useRef<HTMLDivElement>(null);

    const [episode, setEpisode] = useState<EpisodeData | null>(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [selectedPanelIndex, setSelectedPanelIndex] = useState<number | null>(null);
    const [selectedBubbleIndex, setSelectedBubbleIndex] = useState<number | null>(null);
    const [drag, setDrag] = useState<DragState | null>(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [scriptAssistText, setScriptAssistText] = useState("");

    useEffect(() => {
        if (!seriesId || !epId) return;
        getAdminEpisode(seriesId, epId)
            .then((ep) => {
                if (!ep) {
                    setError("Episode not found or admin login is required.");
                    return;
                }
                setEpisode(ep);
                setSelectedPanelIndex(ep.pages[0]?.panels.length ? 0 : null);
            })
            .catch((e) => setError((e as Error).message));
    }, [seriesId, epId]);

    const page = episode?.pages[pageIndex] ?? null;
    const selectedPanel = page && selectedPanelIndex !== null ? page.panels[selectedPanelIndex] : null;
    const selectedBubble = selectedPanel && selectedBubbleIndex !== null ? selectedPanel.bubbles[selectedBubbleIndex] : null;

    const imageUrl = useMemo(() => {
        if (!seriesId || !epId || !page) return "";
        return getAdminPageImageUrl(seriesId, epId, page.pageNumber);
    }, [seriesId, epId, page]);

    const updatePage = useCallback((nextPage: PageData) => {
        setEpisode((current) => {
            if (!current) return current;
            const pages = [...current.pages];
            pages[pageIndex] = nextPage;
            return { ...current, pages };
        });
        setSaved(false);
    }, [pageIndex]);

    const updatePanel = (panelIndex: number, nextPanel: PanelData) => {
        if (!page) return;
        const panels = [...page.panels];
        panels[panelIndex] = nextPanel;
        updatePage({ ...page, panels });
    };

    const addPanel = () => {
        if (!page) return;
        const panelNumber = Math.max(0, ...page.panels.map((p) => p.panelNumber)) + 1;
        const panel: PanelData = {
            id: makePanelId(page, panelNumber),
            panelNumber,
            bbox: {
                x: Math.round(page.width * 0.08),
                y: Math.round(page.height * 0.08),
                width: Math.round(page.width * 0.38),
                height: Math.round(page.height * 0.22),
            },
            reactionTags: [],
            bubbles: [],
        };
        updatePage({ ...page, panels: [...page.panels, panel] });
        setSelectedPanelIndex(page.panels.length);
        setSelectedBubbleIndex(null);
    };

    const deletePanel = () => {
        if (!page || selectedPanelIndex === null) return;
        const panels = page.panels.filter((_, i) => i !== selectedPanelIndex);
        updatePage({ ...page, panels });
        setSelectedPanelIndex(panels.length ? Math.min(selectedPanelIndex, panels.length - 1) : null);
        setSelectedBubbleIndex(null);
    };

    const applyPanelTemplate = (template: PanelTemplate) => {
        if (!page) return;
        if (page.panels.length > 0 && !window.confirm("このページの既存 Panel / Bubble 構造をテンプレートで置き換えます。続行しますか？")) {
            return;
        }
        const panels = buildTemplatePanels(page, template);
        updatePage({ ...page, panels });
        setSelectedPanelIndex(panels.length ? 0 : null);
        setSelectedBubbleIndex(null);
    };

    const clearPanels = () => {
        if (!page || page.panels.length === 0) return;
        if (!window.confirm("このページの Panel / Bubble 構造をすべて削除します。続行しますか？")) return;
        updatePage({ ...page, panels: [] });
        setSelectedPanelIndex(null);
        setSelectedBubbleIndex(null);
    };

    const addBubble = () => {
        if (!page || !selectedPanel || selectedPanelIndex === null) return;
        const bubbleNumber = Math.max(0, ...selectedPanel.bubbles.map((b) => b.bubbleNumber)) + 1;
        const width = Math.max(60, Math.round(selectedPanel.bbox.width * 0.38));
        const height = Math.max(48, Math.round(selectedPanel.bbox.height * 0.34));
        const bubble: BubbleData = {
            id: makeBubbleId(selectedPanel, bubbleNumber),
            bubbleNumber,
            shortId: makeBubbleShortId(page, selectedPanel, bubbleNumber),
            bubbleType: "speech",
            textOriginal: "",
            bbox: clampBox({
                x: Math.round(selectedPanel.bbox.x + selectedPanel.bbox.width - width - 24),
                y: Math.round(selectedPanel.bbox.y + 24),
                width,
                height,
            }, page),
        };
        updatePanel(selectedPanelIndex, { ...selectedPanel, bubbles: [...selectedPanel.bubbles, bubble] });
        setSelectedBubbleIndex(selectedPanel.bubbles.length);
    };

    const deleteBubble = () => {
        if (!selectedPanel || selectedPanelIndex === null || selectedBubbleIndex === null) return;
        const bubbles = selectedPanel.bubbles.filter((_, i) => i !== selectedBubbleIndex);
        updatePanel(selectedPanelIndex, { ...selectedPanel, bubbles });
        setSelectedBubbleIndex(bubbles.length ? Math.min(selectedBubbleIndex, bubbles.length - 1) : null);
    };

    const startDrag = (
        event: React.PointerEvent,
        kind: DragState["kind"],
        mode: DragState["mode"],
        panelIndex: number,
        bubbleIndex?: number,
    ) => {
        if (!page) return;
        event.preventDefault();
        event.stopPropagation();
        const box = bubbleIndex === undefined
            ? page.panels[panelIndex].bbox
            : page.panels[panelIndex].bubbles[bubbleIndex].bbox;
        setSelectedPanelIndex(panelIndex);
        setSelectedBubbleIndex(bubbleIndex ?? null);
        setDrag({
            kind,
            mode,
            panelIndex,
            bubbleIndex,
            startX: event.clientX,
            startY: event.clientY,
            startBox: { ...box },
        });
    };

    useEffect(() => {
        if (!drag || !page) return;

        const onMove = (event: PointerEvent) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const scaleX = rect.width / page.width;
            const scaleY = rect.height / page.height;
            const dx = (event.clientX - drag.startX) / scaleX;
            const dy = (event.clientY - drag.startY) / scaleY;
            const nextBox = drag.mode === "move"
                ? { ...drag.startBox, x: drag.startBox.x + dx, y: drag.startBox.y + dy }
                : { ...drag.startBox, width: drag.startBox.width + dx, height: drag.startBox.height + dy };
            const safeBox = clampBox(nextBox, page);

            const panels = [...page.panels];
            if (drag.kind === "panel") {
                panels[drag.panelIndex] = { ...panels[drag.panelIndex], bbox: safeBox };
            } else if (drag.bubbleIndex !== undefined) {
                const panel = panels[drag.panelIndex];
                const bubbles = [...panel.bubbles];
                bubbles[drag.bubbleIndex] = { ...bubbles[drag.bubbleIndex], bbox: safeBox };
                panels[drag.panelIndex] = { ...panel, bubbles };
            }
            updatePage({ ...page, panels });
        };

        const onUp = () => setDrag(null);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [drag, page, updatePage]);

    const updateSelectedPanelBox = (field: keyof BoundingBox, value: number) => {
        if (!page || !selectedPanel || selectedPanelIndex === null) return;
        updatePanel(selectedPanelIndex, {
            ...selectedPanel,
            bbox: clampBox({ ...selectedPanel.bbox, [field]: value }, page),
        });
    };

    const updateSelectedBubble = (patch: Partial<BubbleData>) => {
        if (!selectedPanel || selectedPanelIndex === null || selectedBubbleIndex === null) return;
        const bubbles = [...selectedPanel.bubbles];
        bubbles[selectedBubbleIndex] = { ...bubbles[selectedBubbleIndex], ...patch };
        updatePanel(selectedPanelIndex, { ...selectedPanel, bubbles });
    };

    const updateSelectedBubbleBox = (field: keyof BoundingBox, value: number) => {
        if (!page || !selectedBubble) return;
        updateSelectedBubble({ bbox: clampBox({ ...selectedBubble.bbox, [field]: value }, page) });
    };

    const updatePageDisplayRef = (displayRef: string) => {
        if (!page) return;
        updatePage({ ...page, displayRef: displayRef.trim() || undefined });
    };

    const applyScriptAssist = () => {
        if (!page || !selectedPanel || selectedPanelIndex === null) {
            setError("Script Assist を使う前に Panel を選択してください。");
            return;
        }
        const parsed = parseScriptAssistLines(scriptAssistText);
        if (parsed.length === 0) {
            setError("取り込むセリフ行がありません。例: うた「……」");
            return;
        }

        const startNumber = Math.max(0, ...selectedPanel.bubbles.map((b) => b.bubbleNumber)) + 1;
        const width = Math.max(72, Math.round(selectedPanel.bbox.width * 0.34));
        const height = Math.max(52, Math.round(selectedPanel.bbox.height * 0.26));
        const gutter = 12;
        const nextBubbles: BubbleData[] = parsed.map((entry, index) => {
            const bubbleNumber = startNumber + index;
            const yOffset = 18 + index * (height + gutter);
            return {
                id: makeBubbleId(selectedPanel, bubbleNumber),
                bubbleNumber,
                shortId: makeBubbleShortId(page, selectedPanel, bubbleNumber),
                bubbleType: entry.bubbleType,
                textOriginal: entry.textOriginal,
                speaker: entry.speaker,
                bbox: clampBox({
                    x: Math.round(selectedPanel.bbox.x + selectedPanel.bbox.width - width - 18),
                    y: Math.round(selectedPanel.bbox.y + yOffset),
                    width,
                    height,
                }, page),
            };
        });

        updatePanel(selectedPanelIndex, {
            ...selectedPanel,
            bubbles: [...selectedPanel.bubbles, ...nextBubbles],
        });
        setSelectedBubbleIndex(selectedPanel.bubbles.length);
        setScriptAssistText("");
        setError("");
    };

    const save = async () => {
        if (!seriesId || !episode) return;
        setSaving(true);
        setError("");
        try {
            await saveEpisode(seriesId, {
                id: episode.id,
                episodeNumber: episode.episodeNumber,
                title: episode.title,
                publishedAt: episode.publishedAt,
                pages: episode.pages,
            });
            setSaved(true);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    if (!episode) {
        return (
            <div>
                <h1>Page Structure Review</h1>
                {error ? <div className="error-msg">{error}</div> : <p style={{ color: "var(--muted)" }}>Loading…</p>}
            </div>
        );
    }

    return (
        <div className="structure-review">
            <div className="structure-header">
                <div>
                    <h1>Page Structure Review</h1>
                    <p className="card-meta">{seriesId} / {episode.id} — panel and bubble structure stays in canonical content only after save.</p>
                </div>
                <div className="section-actions">
                    <Link to={`/works/${seriesId}/episodes/${episode.id}`} className="btn btn-outline">Episode</Link>
                    <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                        {saving ? "保存中…" : "構造を保存"}
                    </button>
                </div>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {saved && <div className="success-msg">構造を保存しました。Publish すると Reader/API に反映されます。</div>}

            <div className="structure-layout">
                <aside className="structure-sidebar card">
                    <div className="form-group">
                        <label>Page</label>
                        <select
                            value={pageIndex}
                            onChange={(e) => {
                                const next = Number(e.target.value);
                                setPageIndex(next);
                                setSelectedPanelIndex(episode.pages[next]?.panels.length ? 0 : null);
                                setSelectedBubbleIndex(null);
                            }}
                        >
                            {episode.pages.map((p, i) => (
                                <option key={p.id} value={i}>
                                    {p.displayRef ? `${p.displayRef} · ` : ""}Page {p.pageNumber} ({p.panels.length} panels)
                                </option>
                            ))}
                        </select>
                    </div>

                    {page && (
                        <div className="form-group">
                            <label>Script display ref</label>
                            <input
                                value={page.displayRef ?? ""}
                                onChange={(e) => updatePageDisplayRef(e.target.value)}
                                placeholder="P1 / P2-a / P2-b"
                            />
                        </div>
                    )}

                    <div className="structure-toolbar">
                        <button type="button" className="btn btn-outline" onClick={addPanel}>+ Panel</button>
                        <button type="button" className="btn btn-outline" onClick={addBubble} disabled={selectedPanelIndex === null}>+ Bubble</button>
                    </div>

                    <h2>Panel Templates</h2>
                    <div className="template-grid">
                        <button type="button" className="template-button" onClick={() => applyPanelTemplate("two-one-two")}>
                            <strong>2 / 1 / 2</strong>
                            <span>ネーム標準</span>
                        </button>
                        <button type="button" className="template-button" onClick={() => applyPanelTemplate("one-one-two")}>
                            <strong>1 / 1 / 2</strong>
                            <span>横長中心</span>
                        </button>
                        <button type="button" className="template-button" onClick={() => applyPanelTemplate("three-rows")}>
                            <strong>3 rows</strong>
                            <span>横3段</span>
                        </button>
                        <button type="button" className="template-button" onClick={() => applyPanelTemplate("six-plus-wide")}>
                            <strong>3×2 + wide</strong>
                            <span>多コマ</span>
                        </button>
                    </div>
                    <button type="button" className="btn btn-outline danger-lite" onClick={clearPanels} disabled={!page?.panels.length}>
                        Clear structure
                    </button>

                    <h2>Script Assist</h2>
                    <div className="script-assist">
                        <textarea
                            value={scriptAssistText}
                            onChange={(e) => setScriptAssistText(e.target.value)}
                            placeholder={"うた「……」\nコンコン「今読んでるビューアーのこと、知りたい？」\n《ピカッ》"}
                            rows={6}
                        />
                        <button type="button" className="btn btn-outline" onClick={applyScriptAssist} disabled={selectedPanelIndex === null}>
                            Add as bubbles
                        </button>
                        <p className="card-meta">選択中 Panel に Bubble 候補を追加します。位置は仮置きなので、右側のInspectorかドラッグで調整してください。</p>
                    </div>

                    <h2>Panels</h2>
                    <div className="structure-list">
                        {page?.panels.map((panel, index) => (
                            <button
                                type="button"
                                key={panel.id}
                                className={`structure-list-item ${selectedPanelIndex === index ? "is-active" : ""}`}
                                onClick={() => {
                                    setSelectedPanelIndex(index);
                                    setSelectedBubbleIndex(null);
                                }}
                            >
                                <span>Panel {panel.panelNumber}</span>
                                <small>{panel.bubbles.length} bubbles</small>
                            </button>
                        ))}
                    </div>

                    <h2>Bubbles</h2>
                    <div className="structure-list">
                        {selectedPanel?.bubbles.map((bubble, index) => (
                            <button
                                type="button"
                                key={bubble.id}
                                className={`structure-list-item ${selectedBubbleIndex === index ? "is-active" : ""}`}
                                onClick={() => setSelectedBubbleIndex(index)}
                            >
                                <span>Bubble {bubble.bubbleNumber}</span>
                                <small>{bubble.textOriginal || "No text"}</small>
                            </button>
                        ))}
                    </div>
                </aside>

                <section className="structure-stage card">
                    {page && (
                        <div className="structure-canvas" ref={canvasRef}>
                            <img src={imageUrl} alt={`Page ${page.pageNumber}`} draggable={false} />
                            <div className="structure-overlay">
                                {page.panels.map((panel, panelIndex) => (
                                    <div
                                        key={panel.id}
                                        className={`bbox bbox-panel ${selectedPanelIndex === panelIndex ? "is-active" : ""}`}
                                        style={toBoxStyle(panel.bbox, page)}
                                        onPointerDown={(e) => startDrag(e, "panel", "move", panelIndex)}
                                    >
                                        <span className="bbox-label">P{panel.panelNumber}</span>
                                        <button
                                            type="button"
                                            className="bbox-resize"
                                            aria-label="Resize panel"
                                            onPointerDown={(e) => startDrag(e, "panel", "resize", panelIndex)}
                                        />
                                    </div>
                                ))}
                                {page.panels.flatMap((panel, panelIndex) => panel.bubbles.map((bubble, bubbleIndex) => (
                                    <div
                                        key={bubble.id}
                                        className={`bbox bbox-bubble ${selectedPanelIndex === panelIndex && selectedBubbleIndex === bubbleIndex ? "is-active" : ""}`}
                                        style={toBoxStyle(bubble.bbox, page)}
                                        onPointerDown={(e) => startDrag(e, "bubble", "move", panelIndex, bubbleIndex)}
                                    >
                                        <span className="bbox-label">B{bubble.bubbleNumber}</span>
                                        <button
                                            type="button"
                                            className="bbox-resize"
                                            aria-label="Resize bubble"
                                            onPointerDown={(e) => startDrag(e, "bubble", "resize", panelIndex, bubbleIndex)}
                                        />
                                    </div>
                                )))}
                            </div>
                        </div>
                    )}
                </section>

                <aside className="structure-inspector card">
                    <h2>Inspector</h2>
                    {page && selectedPanel && selectedPanelIndex !== null ? (
                        <>
                            <div className="section-actions" style={{ marginTop: 0 }}>
                                <span className="badge">Panel {selectedPanel.panelNumber}</span>
                                <button type="button" className="btn btn-outline" onClick={deletePanel}>Delete Panel</button>
                            </div>
                            <div className="bbox-grid">
                                {(["x", "y", "width", "height"] as const).map((field) => (
                                    <div className="form-group" key={field}>
                                        <label>Panel {field}</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedPanel.bbox[field])}
                                            onChange={(e) => updateSelectedPanelBox(field, Number(e.target.value))}
                                        />
                                    </div>
                                ))}
                            </div>

                            {selectedBubble ? (
                                <>
                                    <div className="section-actions">
                                        <span className="badge badge-ok">Bubble {selectedBubble.bubbleNumber}</span>
                                        <button type="button" className="btn btn-outline" onClick={deleteBubble}>Delete Bubble</button>
                                    </div>
                                    <div className="form-group">
                                        <label>Original Text</label>
                                        <textarea
                                            value={selectedBubble.textOriginal}
                                            onChange={(e) => updateSelectedBubble({ textOriginal: e.target.value })}
                                            placeholder="セリフ原文"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Speaker</label>
                                        <input
                                            value={selectedBubble.speaker ?? ""}
                                            onChange={(e) => updateSelectedBubble({ speaker: e.target.value || undefined })}
                                            placeholder="character-id"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Bubble Type</label>
                                        <select
                                            value={selectedBubble.bubbleType}
                                            onChange={(e) => updateSelectedBubble({ bubbleType: e.target.value as BubbleData["bubbleType"] })}
                                        >
                                            <option value="speech">speech</option>
                                            <option value="thought">thought</option>
                                            <option value="narration">narration</option>
                                            <option value="sfx">sfx</option>
                                            <option value="caption">caption</option>
                                            <option value="other">other</option>
                                        </select>
                                    </div>
                                    <div className="bbox-grid">
                                        {(["x", "y", "width", "height"] as const).map((field) => (
                                            <div className="form-group" key={field}>
                                                <label>Bubble {field}</label>
                                                <input
                                                    type="number"
                                                    value={Math.round(selectedBubble.bbox[field])}
                                                    onChange={(e) => updateSelectedBubbleBox(field, Number(e.target.value))}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p className="card-meta">Select or add a bubble to edit text and bubble bbox.</p>
                            )}
                        </>
                    ) : (
                        <p className="card-meta">Add or select a panel to start structure review.</p>
                    )}
                </aside>
            </div>

            <div className="section-actions">
                <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? "保存中…" : "構造を保存"}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => nav(`/works/${seriesId}`)}>
                    Work detail
                </button>
            </div>
        </div>
    );
}
