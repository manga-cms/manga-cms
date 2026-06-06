import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { PageData, PanelData } from "../../api";
import { toBoxStyle } from "../../lib/structure-review/geometry";
import { useTranslation } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n/messages";
import { bubbleReviewKey, panelReviewKey } from "../../lib/structure-review/reviewDecisions";
import { bubbleIdOf, panelIdOf } from "../../lib/structure-review/ids";
import type { DragState, ReviewDecisions, StructureViewport } from "../../lib/structure-review/types";

type CanvasOverlayEditorProps = {
    page: PageData | null;
    imageUrl: string;
    stageRef: RefObject<HTMLElement | null>;
    canvasRef: RefObject<HTMLDivElement | null>;
    viewport: StructureViewport;
    selectedPanelIndex: number | null;
    selectedBubbleIndex: number | null;
    reviewDecisions: ReviewDecisions;
    onViewportChange: (patch: Partial<StructureViewport>) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetView: () => void;
    onFitWidth: () => void;
    onFitScreen: () => void;
    onStartDrag: (
        event: ReactPointerEvent,
        kind: DragState["kind"],
        mode: DragState["mode"],
        panelIndex: number,
        bubbleIndex?: number,
    ) => void;
};

const decisionLabelKey = (decision: string | undefined): MessageKey => `decision.${decision ?? "pending"}` as MessageKey;

export function CanvasOverlayEditor({
    page,
    imageUrl,
    stageRef,
    canvasRef,
    viewport,
    selectedPanelIndex,
    selectedBubbleIndex,
    reviewDecisions,
    onViewportChange,
    onZoomIn,
    onZoomOut,
    onResetView,
    onFitWidth,
    onFitScreen,
    onStartDrag,
}: CanvasOverlayEditorProps) {
    const { t } = useTranslation();
    const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
    const baseCanvasWidth = stageRef.current ? Math.min(Math.max(320, stageRef.current.clientWidth - 32), 736) : null;
    const bubbleOverlays = page
        ? page.panels
            .flatMap((panel, panelIndex) => panel.bubbles.map((bubble, bubbleIndex) => ({ bubble, panelIndex, bubbleIndex })))
            .map((item, index) => ({ ...item, readingOrder: index + 1 }))
        : [];

    const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!viewport.panMode || !stageRef.current) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        panStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            scrollLeft: stageRef.current.scrollLeft,
            scrollTop: stageRef.current.scrollTop,
        };
    };

    const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
        const start = panStartRef.current;
        if (!start || !stageRef.current) return;
        const nextScrollLeft = start.scrollLeft - (event.clientX - start.x);
        const nextScrollTop = start.scrollTop - (event.clientY - start.y);
        stageRef.current.scrollLeft = nextScrollLeft;
        stageRef.current.scrollTop = nextScrollTop;
        onViewportChange({
            panX: stageRef.current.scrollLeft,
            panY: stageRef.current.scrollTop,
        });
    };

    const stopPan = () => {
        panStartRef.current = null;
    };

    const startBoxDrag = (
        event: ReactPointerEvent,
        kind: DragState["kind"],
        mode: DragState["mode"],
        panelIndex: number,
        bubbleIndex?: number,
    ) => {
        if (viewport.panMode) return;
        onStartDrag(event, kind, mode, panelIndex, bubbleIndex);
    };

    return (
        <section className="structure-stage card" ref={stageRef}>
            <div className="structure-canvas-controls" aria-label={t("structure.canvas.controls")}>
                <div className="zoom-controls">
                    <button type="button" className="btn btn-outline" onClick={onZoomOut} aria-label={t("structure.canvas.zoomOut")}>-</button>
                    <span className="zoom-value">{Math.round(viewport.zoom * 100)}%</span>
                    <button type="button" className="btn btn-outline" onClick={onZoomIn} aria-label={t("structure.canvas.zoomIn")}>+</button>
                </div>
                <div className="zoom-controls">
                    <button type="button" className="btn btn-outline" onClick={onFitWidth}>{t("structure.canvas.fitWidth")}</button>
                    <button type="button" className="btn btn-outline" onClick={onFitScreen}>{t("structure.canvas.fitScreen")}</button>
                    <button type="button" className="btn btn-outline" onClick={onResetView}>{t("structure.canvas.reset")}</button>
                    <button
                        type="button"
                        className={`btn btn-outline ${viewport.panMode ? "is-active" : ""}`}
                        onClick={() => onViewportChange({ panMode: !viewport.panMode })}
                    >
                        {t("structure.canvas.pan")}
                    </button>
                </div>
            </div>
            {page && (
                <div
                    className={`structure-canvas ${viewport.panMode ? "is-pan-mode" : ""}`}
                    ref={canvasRef}
                    onPointerDown={startPan}
                    onPointerMove={movePan}
                    onPointerUp={stopPan}
                    onPointerCancel={stopPan}
                    style={{
                        maxWidth: baseCanvasWidth ? `${baseCanvasWidth * viewport.zoom}px` : undefined,
                        minWidth: baseCanvasWidth ? `${baseCanvasWidth * viewport.zoom}px` : undefined,
                        width: baseCanvasWidth ? `${baseCanvasWidth * viewport.zoom}px` : `min(100%, 46rem)`,
                    }}
                >
                    <img src={imageUrl} alt={t("structure.canvas.pageAlt", { pageNumber: page.pageNumber })} draggable={false} />
                    <div className="structure-overlay">
                        {page.panels.map((panel: PanelData, panelIndex: number) => (
                            <div
                                key={panelIdOf(panel)}
                                className={`bbox bbox-panel ${selectedPanelIndex === panelIndex ? "is-active" : ""}`}
                                style={toBoxStyle(panel.bbox, page)}
                                onPointerDown={(e) => startBoxDrag(e, "panel", "move", panelIndex)}
                            >
                                <span className="bbox-label">
                                    {t("structure.canvas.panelLabel", { panelNumber: panel.panelNumber })} · {t(decisionLabelKey(reviewDecisions[panelReviewKey(panel)]))}
                                </span>
                                <button
                                    type="button"
                                    className="bbox-resize"
                                    aria-label={t("structure.canvas.resizePanel")}
                                    onPointerDown={(e) => startBoxDrag(e, "panel", "resize", panelIndex)}
                                />
                            </div>
                        ))}
                        {bubbleOverlays.map(({ bubble, panelIndex, bubbleIndex, readingOrder }) => (
                            <div
                                key={bubbleIdOf(bubble)}
                                className={`bbox bbox-bubble ${selectedPanelIndex === panelIndex && selectedBubbleIndex === bubbleIndex ? "is-active" : ""}`}
                                style={toBoxStyle(bubble.bbox, page)}
                                onPointerDown={(e) => startBoxDrag(e, "bubble", "move", panelIndex, bubbleIndex)}
                            >
                                <span className="bbox-label">
                                    {t("structure.canvas.bubbleLabel", { bubbleNumber: bubble.bubbleNumber })} · {t("structure.sidebar.bubbleCandidateRow", { readingOrder })} · {t(decisionLabelKey(reviewDecisions[bubbleReviewKey(bubble)]))}
                                </span>
                                {bubble.textOriginal && (
                                    <span className="bbox-text">{bubble.textOriginal}</span>
                                )}
                                <button
                                    type="button"
                                    className="bbox-resize"
                                    aria-label={t("structure.canvas.resizeBubble")}
                                    onPointerDown={(e) => startBoxDrag(e, "bubble", "resize", panelIndex, bubbleIndex)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
