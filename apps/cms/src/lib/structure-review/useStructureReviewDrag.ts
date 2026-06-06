import { useEffect, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { PageData } from "../../api";
import { clampBox } from "./geometry";
import type { DragState } from "./types";

type UseStructureReviewDragInput = {
    page: PageData | null;
    canvasRef: RefObject<HTMLDivElement | null>;
    updatePage: (page: PageData) => void;
    onBeforeChange: () => void;
    setSelectedPanelIndex: (index: number) => void;
    setSelectedBubbleIndex: (index: number | null) => void;
};

export function useStructureReviewDrag({
    page,
    canvasRef,
    updatePage,
    onBeforeChange,
    setSelectedPanelIndex,
    setSelectedBubbleIndex,
}: UseStructureReviewDragInput) {
    const [drag, setDrag] = useState<DragState | null>(null);

    const startDrag = (
        event: ReactPointerEvent,
        kind: DragState["kind"],
        mode: DragState["mode"],
        panelIndex: number,
        bubbleIndex?: number,
    ) => {
        if (!page) return;
        event.preventDefault();
        event.stopPropagation();
        onBeforeChange();
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
    }, [canvasRef, drag, page, updatePage]);

    return { startDrag };
}
