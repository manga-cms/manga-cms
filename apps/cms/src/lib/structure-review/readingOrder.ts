import { estimateBubbleReadingOrder, estimatePanelReadingOrder } from "@manga/schemas/reading-order";

import type { BubbleData, PageData, PanelData } from "../../api.ts";
import { bubbleIdOf, makePageBubbleShortId, panelIdOf, renumberPanels } from "./ids.ts";

export type PageReviewWarning = {
    code: "READING_ORDER_SUSPECT";
    pageId?: string;
};

export type ReadingOrderApplyResult = {
    page: PageData;
    changedPanelCount: number;
    changedBubbleCount: number;
};

function pageBubblesOf(page: PageData) {
    return page.bubbles?.length ? page.bubbles : page.panels.flatMap((panel) => panel.bubbles ?? []);
}

function asPanelReadingInputs(panels: PanelData[]) {
    return panels.map((panel) => ({
        panelId: panelIdOf(panel),
        bbox: panel.bbox,
    }));
}

function asBubbleReadingInputs(page: PageData) {
    return pageBubblesOf(page).map((bubble) => ({
        bubbleId: bubbleIdOf(bubble),
        panelId: bubble.panelId ?? null,
        bbox: bubble.bbox,
    }));
}

function sortByRank<T>(items: T[], idOf: (item: T) => string, rank: Map<string, number>) {
    return [...items].sort((a, b) =>
        (rank.get(idOf(a)) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(idOf(b)) ?? Number.MAX_SAFE_INTEGER) ||
        idOf(a).localeCompare(idOf(b)),
    );
}

function countChangedPositions(before: string[], after: string[]) {
    return before.reduce((count, id, index) => count + (after[index] === id ? 0 : 1), 0);
}

export function getPageReviewWarnings(page: PageData | null): PageReviewWarning[] {
    if (!page) return [];
    if (page.panels.length < 2) return [];
    const savedOrder = [...page.panels]
        .sort((a, b) =>
            a.panelNumber - b.panelNumber ||
            (a.displayRef ?? "").localeCompare(b.displayRef ?? "") ||
            panelIdOf(a).localeCompare(panelIdOf(b)),
        )
        .map(panelIdOf);
    const estimatedOrder = estimatePanelReadingOrder(asPanelReadingInputs(page.panels));
    const mismatchCount = savedOrder.reduce((count, panelId, index) => count + (panelId === estimatedOrder[index] ? 0 : 1), 0);
    return mismatchCount > page.panels.length / 2
        ? [{ code: "READING_ORDER_SUSPECT", pageId: page.pageId ?? page.id }]
        : [];
}

export function applyEstimatedReadingOrder(page: PageData): ReadingOrderApplyResult {
    const panelOrder = estimatePanelReadingOrder(asPanelReadingInputs(page.panels));
    const panelRank = new Map(panelOrder.map((panelId, index) => [panelId, index]));
    const orderedPanels = sortByRank(page.panels, panelIdOf, panelRank);

    const bubbleOrder = estimateBubbleReadingOrder({
        width: page.width,
        height: page.height,
        panels: asPanelReadingInputs(page.panels),
        bubbles: asBubbleReadingInputs(page),
    });
    const bubbleRank = new Map(bubbleOrder.map((bubbleId, index) => [bubbleId, index]));
    const orderedPanelsWithBubbles = orderedPanels.map((panel) => ({
        ...panel,
        bubbles: sortByRank(panel.bubbles, bubbleIdOf, bubbleRank),
    }));
    const orderedPageLevelBubbles = sortByRank(
        (page.bubbles ?? []).filter((bubble) => bubble.panelId === null),
        bubbleIdOf,
        bubbleRank,
    ).map((bubble, index): BubbleData => {
        const displayRef = makePageBubbleShortId(page, index + 1);
        return {
            ...bubble,
            panelId: null,
            displayRef,
            shortId: displayRef,
        };
    });

    const beforePanelOrder = page.panels.map(panelIdOf);
    const afterPanelOrder = orderedPanels.map(panelIdOf);
    const beforeBubbleOrder = pageBubblesOf(page).map(bubbleIdOf);
    const afterBubbleOrder = [
        ...orderedPanelsWithBubbles.flatMap((panel) => panel.bubbles.map(bubbleIdOf)),
        ...orderedPageLevelBubbles.map(bubbleIdOf),
    ];

    return {
        page: {
            ...page,
            panels: renumberPanels(page, orderedPanelsWithBubbles),
            bubbles: orderedPageLevelBubbles,
        },
        changedPanelCount: countChangedPositions(beforePanelOrder, afterPanelOrder),
        changedBubbleCount: countChangedPositions(beforeBubbleOrder, afterBubbleOrder),
    };
}
