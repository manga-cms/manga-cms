import type { BubbleData, PageData, PanelData } from "../../api.ts";
import { bubbleIdOf, makePageBubbleShortId, panelIdOf, renumberPanelBubbles } from "./ids.ts";
import { syncPageBubbles } from "./pageBubbles.ts";

export type BubbleMoveResult = {
    page: PageData;
    selectedPanelIndex: number | null;
    selectedBubbleIndex: number;
    changed: boolean;
};

type BubbleLocation = {
    bubble: BubbleData;
    panelIndex: number | null;
    bubbleIndex: number;
};

function orderedBubbleLocations(page: PageData): BubbleLocation[] {
    return [
        ...page.panels.flatMap((panel, panelIndex) =>
            panel.bubbles.map((bubble, bubbleIndex) => ({ bubble, panelIndex, bubbleIndex })),
        ),
        ...(page.bubbles ?? [])
            .filter((bubble) => bubble.panelId === null)
            .map((bubble, bubbleIndex) => ({ bubble, panelIndex: null, bubbleIndex })),
    ];
}

function insertRelativeToNeighbor(
    items: BubbleData[],
    movingBubble: BubbleData,
    neighborId: string,
    direction: -1 | 1,
) {
    const neighborIndex = items.findIndex((item) => bubbleIdOf(item) === neighborId);
    const insertIndex = neighborIndex < 0
        ? (direction < 0 ? 0 : items.length)
        : neighborIndex + (direction < 0 ? 0 : 1);
    const next = [...items];
    next.splice(insertIndex, 0, movingBubble);
    return {
        items: next,
        index: insertIndex,
    };
}

function renumberPageLevelBubbles(page: PageData, bubbles: BubbleData[]) {
    return bubbles.map((bubble, index): BubbleData => {
        const displayRef = makePageBubbleShortId(page, index + 1);
        return {
            ...bubble,
            panelId: null,
            bubbleNumber: index + 1,
            displayRef,
            shortId: displayRef,
        };
    });
}

export function canMoveBubbleByGlobalReadingOrder(page: PageData | null, bubbleId: string, direction: -1 | 1) {
    if (!page) return false;
    const locations = orderedBubbleLocations(page);
    const index = locations.findIndex((location) => bubbleIdOf(location.bubble) === bubbleId);
    return index >= 0 && index + direction >= 0 && index + direction < locations.length;
}

export function moveBubbleByGlobalReadingOrder(
    page: PageData,
    bubbleId: string,
    direction: -1 | 1,
): BubbleMoveResult {
    const locations = orderedBubbleLocations(page);
    const currentIndex = locations.findIndex((location) => bubbleIdOf(location.bubble) === bubbleId);
    const neighbor = locations[currentIndex + direction];
    const current = locations[currentIndex];
    if (!current || !neighbor) {
        return {
            page,
            selectedPanelIndex: current?.panelIndex ?? null,
            selectedBubbleIndex: current?.bubbleIndex ?? 0,
            changed: false,
        };
    }

    const movingBubbleId = bubbleIdOf(current.bubble);
    const neighborId = bubbleIdOf(neighbor.bubble);
    const panels: PanelData[] = page.panels.map((panel) => ({
        ...panel,
        bubbles: panel.bubbles.filter((bubble) => bubbleIdOf(bubble) !== movingBubbleId),
    }));
    const pageLevelBubbles = (page.bubbles ?? [])
        .filter((bubble) => bubble.panelId === null && bubbleIdOf(bubble) !== movingBubbleId);

    if (neighbor.panelIndex === null) {
        const movingBubble: BubbleData = {
            ...current.bubble,
            panelId: null,
        };
        const inserted = insertRelativeToNeighbor(pageLevelBubbles, movingBubble, neighborId, direction);
        return {
            page: syncPageBubbles({
                ...page,
                panels,
                bubbles: renumberPageLevelBubbles(page, inserted.items),
            }),
            selectedPanelIndex: null,
            selectedBubbleIndex: inserted.index,
            changed: true,
        };
    }

    const targetPanel = panels[neighbor.panelIndex];
    if (!targetPanel) {
        return {
            page,
            selectedPanelIndex: current.panelIndex,
            selectedBubbleIndex: current.bubbleIndex,
            changed: false,
        };
    }

    const movingBubble: BubbleData = {
        ...current.bubble,
        panelId: panelIdOf(targetPanel),
    };
    const inserted = insertRelativeToNeighbor(targetPanel.bubbles, movingBubble, neighborId, direction);
    panels[neighbor.panelIndex] = renumberPanelBubbles(page, {
        ...targetPanel,
        bubbles: inserted.items,
    });

    return {
        page: syncPageBubbles({
            ...page,
            panels,
            bubbles: renumberPageLevelBubbles(page, pageLevelBubbles),
        }),
        selectedPanelIndex: neighbor.panelIndex,
        selectedBubbleIndex: inserted.index,
        changed: true,
    };
}
