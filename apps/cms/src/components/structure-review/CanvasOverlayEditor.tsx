import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { buildLetteringRender, displayDirectionForLanguage } from "@manga/lettering";
import { refitLetteringNow } from "@manga/lettering/refit";
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
    letteringMode?: boolean;
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
        panelIndex: number | null,
        bubbleIndex?: number,
    ) => void;
};

const decisionLabelKey = (decision: string | undefined): MessageKey => `decision.${decision ?? "pending"}` as MessageKey;

export function CanvasOverlayEditor({
    page,
    imageUrl,
    letteringMode = false,
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
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const baseCanvasWidth = stageRef.current ? Math.min(Math.max(320, stageRef.current.clientWidth - 32), 736) : null;
    const bubbleOverlays = page
        ? [
            ...page.panels.flatMap((panel, panelIndex) => panel.bubbles.map((bubble, bubbleIndex) => ({ bubble, panelIndex: panelIndex as number | null, bubbleIndex }))),
            ...(page.bubbles ?? [])
                .filter((bubble) => bubble.panelId === null)
                .map((bubble, bubbleIndex) => ({ bubble, panelIndex: null, bubbleIndex })),
        ]
            .map((item, index) => ({ ...item, readingOrder: index + 1 }))
        : [];

    useEffect(() => {
        if (!letteringMode || !overlayRef.current) return;
        refitLetteringNow(overlayRef.current);
    }, [letteringMode, page]);

    const letteringRenderFor = (bubble: any) => {
        if (!page) return null;
        const displayDirection = displayDirectionForLanguage(bubble.textDirection, "ja");
        return buildLetteringRender({
            source: {
                text: bubble.textOriginal ?? "",
                textLayout: bubble.textLayout,
                textStyle: bubble.textStyle,
            },
            bbox: bubble.bbox ?? {},
            page: { width: page.width, height: page.height },
            displayDirection,
            addJapaneseSoftBreaks: displayDirection === "vertical",
            spaceAsBreak: false,
        });
    };

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
        panelIndex: number | null,
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
                    <div className="structure-overlay" ref={overlayRef}>
                        {page.panels.map((panel: PanelData, panelIndex: number) => (
                            <div
                                key={panelIdOf(panel)}
                                className={`bbox bbox-panel ${selectedPanelIndex === panelIndex ? "is-active" : ""}`}
                                style={toBoxStyle(panel.bbox, page)}
                                onPointerDown={(e) => startBoxDrag(e, "panel", "move", panelIndex)}
                            >
                                <span className="bbox-label" title={`${t("structure.canvas.panelLabel", { panelNumber: panel.panelNumber })} · ${t(decisionLabelKey(reviewDecisions[panelReviewKey(panel)]))}`}>
                                    {t("structure.canvas.panelLabel", { panelNumber: panel.panelNumber })}
                                </span>
                                <button
                                    type="button"
                                    className="bbox-resize"
                                    aria-label={t("structure.canvas.resizePanel")}
                                    onPointerDown={(e) => startBoxDrag(e, "panel", "resize", panelIndex)}
                                />
                            </div>
                        ))}
                        {letteringMode && bubbleOverlays.map(({ bubble }) => {
                            const render = letteringRenderFor(bubble);
                            if (!render) return null;
                            const displayDirection = displayDirectionForLanguage(bubble.textDirection, "ja");
                            return (
                                <p
                                    key={`lettering-${bubbleIdOf(bubble)}`}
                                    className={`lettering-preview-bubble ${displayDirection === "vertical" ? "is-vertical" : "is-horizontal"}`}
                                    data-overlay-bubble
                                    data-fit-mode={render.fitMode}
                                    data-fit-characters={render.fit.characterCount}
                                    data-inline-align={render.inlineAlign}
                                    data-block-align={render.blockAlign}
                                    style={render.style as CSSProperties}
                                >
                                    <span data-overlay-bubble-text>{render.text}</span>
                                </p>
                            );
                        })}
                        {bubbleOverlays.map(({ bubble, panelIndex, bubbleIndex, readingOrder }) => (
                            <div
                                key={bubbleIdOf(bubble)}
                                className={`bbox bbox-bubble ${letteringMode ? "is-lettering-preview" : ""} ${selectedPanelIndex === panelIndex && selectedBubbleIndex === bubbleIndex ? "is-active" : ""}`}
                                style={toBoxStyle(bubble.bbox, page)}
                                onPointerDown={(e) => startBoxDrag(e, "bubble", "move", panelIndex, bubbleIndex)}
                            >
                                <span
                                    className="bbox-label"
                                    title={[
                                        t("structure.canvas.bubbleLabel", { bubbleNumber: bubble.bubbleNumber }),
                                        t("structure.sidebar.bubbleCandidateRow", { readingOrder }),
                                        t(decisionLabelKey(reviewDecisions[bubbleReviewKey(bubble)])),
                                        bubble.textOriginal,
                                    ].filter(Boolean).join(" · ")}
                                >
                                    {bubble.displayRef ?? bubble.shortId ?? t("structure.canvas.bubbleLabel", { bubbleNumber: bubble.bubbleNumber })}
                                </span>
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
