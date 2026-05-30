import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { BubbleData, PageData, PanelData } from "../../api";
import { toBoxStyle } from "../../lib/structure-review/geometry";
import { bubbleReviewKey, panelReviewKey } from "../../lib/structure-review/reviewDecisions";
import type { DragState, ReviewDecisions } from "../../lib/structure-review/types";

type CanvasOverlayEditorProps = {
    page: PageData | null;
    imageUrl: string;
    canvasRef: RefObject<HTMLDivElement | null>;
    selectedPanelIndex: number | null;
    selectedBubbleIndex: number | null;
    reviewDecisions: ReviewDecisions;
    onStartDrag: (
        event: ReactPointerEvent,
        kind: DragState["kind"],
        mode: DragState["mode"],
        panelIndex: number,
        bubbleIndex?: number,
    ) => void;
};

export function CanvasOverlayEditor({
    page,
    imageUrl,
    canvasRef,
    selectedPanelIndex,
    selectedBubbleIndex,
    reviewDecisions,
    onStartDrag,
}: CanvasOverlayEditorProps) {
    return (
        <section className="structure-stage card">
            {page && (
                <div className="structure-canvas" ref={canvasRef}>
                    <img src={imageUrl} alt={`Page ${page.pageNumber}`} draggable={false} />
                    <div className="structure-overlay">
                        {page.panels.map((panel: PanelData, panelIndex: number) => (
                            <div
                                key={panel.id}
                                className={`bbox bbox-panel ${selectedPanelIndex === panelIndex ? "is-active" : ""}`}
                                style={toBoxStyle(panel.bbox, page)}
                                onPointerDown={(e) => onStartDrag(e, "panel", "move", panelIndex)}
                            >
                                <span className="bbox-label">P{panel.panelNumber} · {reviewDecisions[panelReviewKey(panel)] ?? "pending"}</span>
                                <button
                                    type="button"
                                    className="bbox-resize"
                                    aria-label="Resize panel"
                                    onPointerDown={(e) => onStartDrag(e, "panel", "resize", panelIndex)}
                                />
                            </div>
                        ))}
                        {page.panels.flatMap((panel, panelIndex) => panel.bubbles.map((bubble: BubbleData, bubbleIndex: number) => (
                            <div
                                key={bubble.id}
                                className={`bbox bbox-bubble ${selectedPanelIndex === panelIndex && selectedBubbleIndex === bubbleIndex ? "is-active" : ""}`}
                                style={toBoxStyle(bubble.bbox, page)}
                                onPointerDown={(e) => onStartDrag(e, "bubble", "move", panelIndex, bubbleIndex)}
                            >
                                <span className="bbox-label">B{bubble.bubbleNumber}</span>
                                {bubble.textOriginal && (
                                    <span className="bbox-text">{bubble.textOriginal}</span>
                                )}
                                <button
                                    type="button"
                                    className="bbox-resize"
                                    aria-label="Resize bubble"
                                    onPointerDown={(e) => onStartDrag(e, "bubble", "resize", panelIndex, bubbleIndex)}
                                />
                            </div>
                        )))}
                    </div>
                </div>
            )}
        </section>
    );
}
