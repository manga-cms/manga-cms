import type { BubbleData, PageData, PanelData } from "../../api";

function pad(n: number) {
    return String(n).padStart(3, "0");
}

export function makePanelId(page: PageData, panelNumber: number) {
    return `${page.id}-k${pad(panelNumber)}`;
}

export function makeBubbleId(panel: PanelData, bubbleNumber: number) {
    return `${panel.id}-f${pad(bubbleNumber)}`;
}

export function makeBubbleShortId(page: PageData, panel: PanelData, bubbleNumber: number) {
    return `p${page.pageNumber}-k${panel.panelNumber}-f${bubbleNumber}`;
}

export function nextPanelIdNumber(page: PageData) {
    return Math.max(0, ...page.panels.map((panel) => Number(panel.id.match(/-k(\d+)$/)?.[1] ?? panel.panelNumber))) + 1;
}

export function nextBubbleIdNumber(panel: PanelData) {
    return Math.max(0, ...panel.bubbles.map((bubble) => Number(bubble.id.match(/-f(\d+)$/)?.[1] ?? bubble.bubbleNumber))) + 1;
}

export function renumberPanels(page: PageData, panels: PanelData[]) {
    return panels.map((panel, panelIndex) => {
        const nextPanel = { ...panel, panelNumber: panelIndex + 1 };
        return {
            ...nextPanel,
            bubbles: nextPanel.bubbles.map((bubble: BubbleData, bubbleIndex: number) => ({
                ...bubble,
                bubbleNumber: bubbleIndex + 1,
                shortId: makeBubbleShortId(page, nextPanel, bubbleIndex + 1),
            })),
        };
    });
}
