import type { BubbleData, PageData, PanelData } from "../../api";

function pad(n: number) {
    return String(n).padStart(3, "0");
}

export function makePanelId(page: PageData, panelNumber: number) {
    return `${pageIdOf(page)}-k${pad(panelNumber)}`;
}

export function makeBubbleId(panel: PanelData, bubbleNumber: number) {
    return `${panelIdOf(panel)}-f${pad(bubbleNumber)}`;
}

export function makeBubbleShortId(page: PageData, panel: PanelData, bubbleNumber: number) {
    return `p${page.pageNumber}-k${panel.panelNumber}-f${bubbleNumber}`;
}

export function nextPanelIdNumber(page: PageData) {
    return Math.max(0, ...page.panels.map((panel) => Number(panelIdOf(panel).match(/-k(\d+)$/)?.[1] ?? panel.panelNumber))) + 1;
}

export function nextBubbleIdNumber(panel: PanelData) {
    return Math.max(0, ...panel.bubbles.map((bubble) => Number(bubbleIdOf(bubble).match(/-f(\d+)$/)?.[1] ?? bubble.bubbleNumber))) + 1;
}

export function renumberPanels(page: PageData, panels: PanelData[]) {
    return panels.map((panel, panelIndex) => {
        const panelId = panelIdOf(panel);
        const nextPanel = {
            ...panel,
            id: panel.id ?? panelId,
            panelId,
            stableRef: panel.stableRef ?? panelId,
            panelNumber: panelIndex + 1,
        };
        return {
            ...nextPanel,
            bubbles: nextPanel.bubbles.map((bubble: BubbleData, bubbleIndex: number) => ({
                ...bubble,
                id: bubble.id ?? bubbleIdOf(bubble),
                bubbleId: bubbleIdOf(bubble),
                panelId,
                stableRef: bubble.stableRef ?? bubbleIdOf(bubble),
                bubbleNumber: bubbleIndex + 1,
                displayRef: makeBubbleShortId(page, nextPanel, bubbleIndex + 1),
                shortId: makeBubbleShortId(page, nextPanel, bubbleIndex + 1),
            })),
        };
    });
}

export function renumberPanelBubbles(page: PageData, panel: PanelData): PanelData {
    const panelId = panelIdOf(panel);
    return {
        ...panel,
        id: panel.id ?? panelId,
        panelId,
        stableRef: panel.stableRef ?? panelId,
        bubbles: panel.bubbles.map((bubble: BubbleData, bubbleIndex: number) => {
            const bubbleId = bubbleIdOf(bubble);
            const displayRef = makeBubbleShortId(page, panel, bubbleIndex + 1);
            return {
                ...bubble,
                id: bubble.id ?? bubbleId,
                bubbleId,
                panelId,
                stableRef: bubble.stableRef ?? bubbleId,
                bubbleNumber: bubbleIndex + 1,
                displayRef,
                shortId: displayRef,
            };
        }),
    };
}

export function pageIdOf(page: Pick<PageData, "pageId" | "id">) {
    return page.pageId ?? page.id;
}

export function panelIdOf(panel: Pick<PanelData, "panelId" | "id">) {
    return panel.panelId ?? panel.id;
}

export function bubbleIdOf(bubble: Pick<BubbleData, "bubbleId" | "id">) {
    return bubble.bubbleId ?? bubble.id;
}
