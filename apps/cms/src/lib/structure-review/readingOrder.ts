import { estimateBubbleReadingOrder, estimatePanelReadingOrder } from "@manga/schemas/reading-order";

import type { BubbleData, PageData, PanelData } from "../../api.ts";
import { bubbleIdOf, makePageBubbleShortId, panelIdOf, renumberPanels } from "./ids.ts";
import { syncPageBubbles } from "./pageBubbles.ts";

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

function panelSignature(panel: PanelData) {
    return [
        panelIdOf(panel),
        panel.panelNumber,
        panel.displayRef ?? "",
        panel.shortId ?? "",
    ].join(":");
}

function bubbleSignature(bubble: BubbleData) {
    return [
        bubbleIdOf(bubble),
        bubble.panelId ?? "",
        bubble.bubbleNumber,
        bubble.displayRef ?? "",
        bubble.shortId ?? "",
    ].join(":");
}

function countChangedSignatures(before: string[], after: string[]) {
    const length = Math.max(before.length, after.length);
    let count = 0;
    for (let index = 0; index < length; index += 1) {
        if (before[index] !== after[index]) count += 1;
    }
    return count;
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
    const sourceBubbles = pageBubblesOf(page);
    const rankedBubbles = sortByRank(sourceBubbles, bubbleIdOf, bubbleRank);
    const bubblesByPanelId = new Map<string, BubbleData[]>();
    for (const bubble of rankedBubbles) {
        if (!bubble.panelId) continue;
        const items = bubblesByPanelId.get(bubble.panelId) ?? [];
        items.push(bubble);
        bubblesByPanelId.set(bubble.panelId, items);
    }
    const orderedPanelsWithBubbles = orderedPanels.map((panel) => ({
        ...panel,
        bubbles: bubblesByPanelId.get(panelIdOf(panel)) ?? [],
    }));
    const orderedPageLevelBubbles = sortByRank(
        rankedBubbles.filter((bubble) => bubble.panelId === null),
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

    const nextPage = syncPageBubbles({
        ...page,
        panels: renumberPanels(page, orderedPanelsWithBubbles),
        bubbles: orderedPageLevelBubbles,
    });

    const beforePanelSignatures = page.panels.map(panelSignature);
    const afterPanelSignatures = nextPage.panels.map(panelSignature);
    const beforeBubbleSignatures = pageBubblesOf(page).map(bubbleSignature);
    const afterBubbleSignatures = pageBubblesOf(nextPage).map(bubbleSignature);

    return {
        page: nextPage,
        changedPanelCount: countChangedSignatures(beforePanelSignatures, afterPanelSignatures),
        changedBubbleCount: countChangedSignatures(beforeBubbleSignatures, afterBubbleSignatures),
    };
}
