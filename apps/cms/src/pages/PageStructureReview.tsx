import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { CanvasOverlayEditor } from "../components/structure-review/CanvasOverlayEditor";
import { PageStructureSidebar } from "../components/structure-review/PageStructureSidebar";
import { StructureInspector } from "../components/structure-review/StructureInspector";
import { StructureReviewFooter } from "../components/structure-review/StructureReviewFooter";
import { StructureReviewHeader } from "../components/structure-review/StructureReviewHeader";
import { clampBox } from "../lib/structure-review/geometry";
import { makeBubbleId, makeBubbleShortId, makePanelId, nextBubbleIdNumber, nextPanelIdNumber, renumberPanels } from "../lib/structure-review/ids";
import { buildTemplatePanels } from "../lib/structure-review/panelTemplates";
import { bubbleReviewKey, markPanels, panelReviewKey, seedAcceptedDecisions, summarizeReview } from "../lib/structure-review/reviewDecisions";
import { parseScriptAssistLines } from "../lib/structure-review/scriptAssist";
import type { PanelTemplate, ReviewDecisions, StructureViewport } from "../lib/structure-review/types";
import { useStructureReviewDrag } from "../lib/structure-review/useStructureReviewDrag";

const MIN_STRUCTURE_ZOOM = 0.35;
const MAX_STRUCTURE_ZOOM = 3;

function clampStructureZoom(zoom: number) {
    return Math.max(MIN_STRUCTURE_ZOOM, Math.min(MAX_STRUCTURE_ZOOM, zoom));
}

export default function PageStructureReview() {
    const { id: seriesId, epId } = useParams<{ id: string; epId: string }>();
    const nav = useNavigate();
    const stageRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    const [episode, setEpisode] = useState<EpisodeData | null>(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [selectedPanelIndex, setSelectedPanelIndex] = useState<number | null>(null);
    const [selectedBubbleIndex, setSelectedBubbleIndex] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [scriptAssistText, setScriptAssistText] = useState("");
    const [reviewDecisions, setReviewDecisions] = useState<ReviewDecisions>({});
    const [structureViewport, setStructureViewport] = useState<StructureViewport>({
        zoom: 1,
        panX: 0,
        panY: 0,
        panMode: false,
    });

    useEffect(() => {
        if (!seriesId || !epId) return;
        getAdminEpisode(seriesId, epId)
            .then((ep) => {
                if (!ep) {
                    setError("Episode not found or admin login is required.");
                    return;
                }
                setEpisode(ep);
                setReviewDecisions(seedAcceptedDecisions(ep));
                setSelectedPanelIndex(ep.pages[0]?.panels.length ? 0 : null);
            })
            .catch((e) => setError((e as Error).message));
    }, [seriesId, epId]);

    const page = episode?.pages[pageIndex] ?? null;
    const selectedPanel = page && selectedPanelIndex !== null ? page.panels[selectedPanelIndex] : null;
    const selectedBubble = selectedPanel && selectedBubbleIndex !== null ? selectedPanel.bubbles[selectedBubbleIndex] : null;
    const selectedPanelDecision = selectedPanel ? reviewDecisions[panelReviewKey(selectedPanel)] ?? "pending" : null;
    const selectedBubbleDecision = selectedBubble ? reviewDecisions[bubbleReviewKey(selectedBubble)] ?? "pending" : null;

    const imageUrl = useMemo(() => {
        if (!seriesId || !epId || !page) return "";
        return getAdminPageImageUrl(seriesId, epId, page.pageNumber);
    }, [seriesId, epId, page]);

    const reviewSummary = useMemo(() => {
        return summarizeReview(page, reviewDecisions);
    }, [page, reviewDecisions]);

    useEffect(() => {
        stageRef.current?.scrollTo({ left: 0, top: 0 });
        setStructureViewport((current) => ({
            ...current,
            panX: 0,
            panY: 0,
            panMode: false,
        }));
    }, [pageIndex]);

    const updatePage = useCallback((nextPage: PageData) => {
        setEpisode((current) => {
            if (!current) return current;
            const pages = [...current.pages];
            pages[pageIndex] = nextPage;
            return { ...current, pages };
        });
        setSaved(false);
    }, [pageIndex]);

    const { startDrag } = useStructureReviewDrag({
        page,
        canvasRef,
        updatePage,
        setSelectedPanelIndex,
        setSelectedBubbleIndex,
    });

    const updateStructureViewport = useCallback((patch: Partial<StructureViewport>) => {
        setStructureViewport((current) => ({
            ...current,
            ...patch,
            zoom: patch.zoom === undefined ? current.zoom : clampStructureZoom(patch.zoom),
        }));
    }, []);

    const zoomStructureCanvas = useCallback((delta: number) => {
        setStructureViewport((current) => ({
            ...current,
            zoom: clampStructureZoom(current.zoom + delta),
        }));
    }, []);

    const resetStructureScroll = useCallback(() => {
        stageRef.current?.scrollTo({ left: 0, top: 0 });
    }, []);

    const resetStructureView = useCallback(() => {
        resetStructureScroll();
        setStructureViewport({
            zoom: 1,
            panX: 0,
            panY: 0,
            panMode: false,
        });
    }, [resetStructureScroll]);

    const fitStructureWidth = useCallback(() => {
        resetStructureScroll();
        setStructureViewport((current) => ({
            ...current,
            zoom: 1,
            panX: 0,
            panY: 0,
            panMode: false,
        }));
    }, [resetStructureScroll]);

    const fitStructureScreen = useCallback(() => {
        if (!stageRef.current || !page) {
            fitStructureWidth();
            return;
        }
        const stageRect = stageRef.current.getBoundingClientRect();
        const availableWidth = Math.max(320, stageRef.current.clientWidth - 32);
        const baseWidth = Math.min(availableWidth, 736);
        const baseHeight = baseWidth * (page.height / page.width);
        const availableHeight = Math.max(280, window.innerHeight - stageRect.top - 96);
        resetStructureScroll();
        setStructureViewport((current) => ({
            ...current,
            zoom: clampStructureZoom(Math.min(1, availableHeight / baseHeight)),
            panX: 0,
            panY: 0,
            panMode: false,
        }));
    }, [fitStructureWidth, page, resetStructureScroll]);

    const updatePanel = (panelIndex: number, nextPanel: PanelData) => {
        if (!page) return;
        const panels = [...page.panels];
        panels[panelIndex] = nextPanel;
        updatePage({ ...page, panels });
    };

    const addPanel = () => {
        if (!page) return;
        const panelNumber = page.panels.length + 1;
        const panel: PanelData = {
            id: makePanelId(page, nextPanelIdNumber(page)),
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
        setReviewDecisions((current) => markPanels(current, [panel], "pending"));
        setSelectedPanelIndex(page.panels.length);
        setSelectedBubbleIndex(null);
    };

    const deletePanel = () => {
        if (!page || selectedPanelIndex === null) return;
        const panels = renumberPanels(page, page.panels.filter((_, i) => i !== selectedPanelIndex));
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
        setReviewDecisions((current) => markPanels(current, panels, "pending"));
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
        const bubbleNumber = selectedPanel.bubbles.length + 1;
        const width = Math.max(60, Math.round(selectedPanel.bbox.width * 0.38));
        const height = Math.max(48, Math.round(selectedPanel.bbox.height * 0.34));
        const bubble: BubbleData = {
            id: makeBubbleId(selectedPanel, nextBubbleIdNumber(selectedPanel)),
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
        setReviewDecisions((current) => ({ ...current, [bubbleReviewKey(bubble)]: "pending" }));
        setSelectedBubbleIndex(selectedPanel.bubbles.length);
    };

    const deleteBubble = () => {
        if (!selectedPanel || selectedPanelIndex === null || selectedBubbleIndex === null) return;
        const bubbles = selectedPanel.bubbles.filter((_, i) => i !== selectedBubbleIndex);
        const nextPanel = renumberPanels(page!, [{ ...selectedPanel, bubbles }])[0];
        updatePanel(selectedPanelIndex, nextPanel);
        setSelectedBubbleIndex(bubbles.length ? Math.min(selectedBubbleIndex, bubbles.length - 1) : null);
    };

    const movePanel = (fromIndex: number, direction: -1 | 1) => {
        if (!page) return;
        const toIndex = fromIndex + direction;
        if (toIndex < 0 || toIndex >= page.panels.length) return;
        const panels = [...page.panels];
        [panels[fromIndex], panels[toIndex]] = [panels[toIndex], panels[fromIndex]];
        updatePage({ ...page, panels: renumberPanels(page, panels) });
        setSelectedPanelIndex(toIndex);
        setSelectedBubbleIndex(null);
    };

    const moveBubble = (fromIndex: number, direction: -1 | 1) => {
        if (!page || !selectedPanel || selectedPanelIndex === null) return;
        const toIndex = fromIndex + direction;
        if (toIndex < 0 || toIndex >= selectedPanel.bubbles.length) return;
        const bubbles = [...selectedPanel.bubbles];
        [bubbles[fromIndex], bubbles[toIndex]] = [bubbles[toIndex], bubbles[fromIndex]];
        const nextPanel = renumberPanels(page, [{ ...selectedPanel, bubbles }])[0];
        updatePanel(selectedPanelIndex, nextPanel);
        setSelectedBubbleIndex(toIndex);
    };

    const acceptPanel = (panel: PanelData) => {
        setReviewDecisions((current) => markPanels(current, [panel], "accepted"));
        setError("");
    };

    const acceptBubble = (bubble: BubbleData) => {
        setReviewDecisions((current) => ({ ...current, [bubbleReviewKey(bubble)]: "accepted" }));
        setError("");
    };

    const rejectSelectedPanel = () => {
        if (!selectedPanel) return;
        setReviewDecisions((current) => markPanels(current, [selectedPanel], "rejected"));
        deletePanel();
    };

    const rejectSelectedBubble = () => {
        if (!selectedBubble) return;
        setReviewDecisions((current) => ({ ...current, [bubbleReviewKey(selectedBubble)]: "rejected" }));
        deleteBubble();
    };

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

        const startNumber = selectedPanel.bubbles.length + 1;
        const startIdNumber = nextBubbleIdNumber(selectedPanel);
        const width = Math.max(72, Math.round(selectedPanel.bbox.width * 0.34));
        const height = Math.max(52, Math.round(selectedPanel.bbox.height * 0.26));
        const gutter = 12;
        const nextBubbles: BubbleData[] = parsed.map((entry, index) => {
            const bubbleNumber = startNumber + index;
            const yOffset = 18 + index * (height + gutter);
            return {
                id: makeBubbleId(selectedPanel, startIdNumber + index),
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
        setReviewDecisions((current) => {
            const next = { ...current };
            nextBubbles.forEach((bubble) => {
                next[bubbleReviewKey(bubble)] = "pending";
            });
            return next;
        });
        setSelectedBubbleIndex(selectedPanel.bubbles.length);
        setScriptAssistText("");
        setError("");
    };

    const save = async () => {
        if (!seriesId || !episode) return;
        if (reviewSummary.pending > 0) {
            setError(`${reviewSummary.pending} 件の未確認 Panel / Bubble 候補があります。Accept または Reject してから保存してください。`);
            return;
        }
        setSaving(true);
        setError("");
        try {
            await saveEpisode(seriesId, {
                id: episode.id,
                episodeNumber: episode.episodeNumber,
                title: episode.title,
                publishedAt: episode.publishedAt,
                publishStartAt: episode.publishStartAt,
                publishEndAt: episode.publishEndAt,
                visibility: episode.visibility,
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
            <StructureReviewHeader
                seriesId={seriesId}
                episodeId={episode.id}
                saving={saving}
                onSave={save}
            />

            {error && <div className="error-msg">{error}</div>}
            {saved && <div className="success-msg">構造を保存しました。Publish すると Reader/API に反映されます。</div>}

            <div className="structure-layout">
                <PageStructureSidebar
                    episode={episode}
                    page={page}
                    pageIndex={pageIndex}
                    selectedPanel={selectedPanel}
                    selectedPanelIndex={selectedPanelIndex}
                    selectedBubbleIndex={selectedBubbleIndex}
                    scriptAssistText={scriptAssistText}
                    reviewDecisions={reviewDecisions}
                    reviewSummary={reviewSummary}
                    onPageChange={(next) => {
                        setPageIndex(next);
                        setSelectedPanelIndex(episode.pages[next]?.panels.length ? 0 : null);
                        setSelectedBubbleIndex(null);
                    }}
                    onPageDisplayRefChange={updatePageDisplayRef}
                    onAddPanel={addPanel}
                    onAddBubble={addBubble}
                    onApplyPanelTemplate={applyPanelTemplate}
                    onClearPanels={clearPanels}
                    onScriptAssistTextChange={setScriptAssistText}
                    onApplyScriptAssist={applyScriptAssist}
                    onSelectPanel={(index) => {
                        setSelectedPanelIndex(index);
                        setSelectedBubbleIndex(null);
                    }}
                    onSelectBubble={setSelectedBubbleIndex}
                    onMovePanel={movePanel}
                    onMoveBubble={moveBubble}
                />

                <CanvasOverlayEditor
                    page={page}
                    imageUrl={imageUrl}
                    stageRef={stageRef}
                    canvasRef={canvasRef}
                    viewport={structureViewport}
                    selectedPanelIndex={selectedPanelIndex}
                    selectedBubbleIndex={selectedBubbleIndex}
                    reviewDecisions={reviewDecisions}
                    onViewportChange={updateStructureViewport}
                    onZoomIn={() => zoomStructureCanvas(0.15)}
                    onZoomOut={() => zoomStructureCanvas(-0.15)}
                    onResetView={resetStructureView}
                    onFitWidth={fitStructureWidth}
                    onFitScreen={fitStructureScreen}
                    onStartDrag={startDrag}
                />

                <StructureInspector
                    page={page}
                    selectedPanel={selectedPanel}
                    selectedPanelIndex={selectedPanelIndex}
                    selectedBubble={selectedBubble}
                    selectedPanelDecision={selectedPanelDecision}
                    selectedBubbleDecision={selectedBubbleDecision}
                    onUpdatePanel={updatePanel}
                    onUpdateSelectedPanelBox={updateSelectedPanelBox}
                    onUpdateSelectedBubble={updateSelectedBubble}
                    onUpdateSelectedBubbleBox={updateSelectedBubbleBox}
                    onAcceptPanel={acceptPanel}
                    onRejectSelectedPanel={rejectSelectedPanel}
                    onAcceptBubble={acceptBubble}
                    onRejectSelectedBubble={rejectSelectedBubble}
                />
            </div>

            <StructureReviewFooter
                saving={saving}
                onSave={save}
                onWorkDetail={() => nav(`/works/${seriesId}`)}
            />
        </div>
    );
}
