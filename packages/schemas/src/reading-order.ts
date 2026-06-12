export type ReadingOrderBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type PanelReadingOrderInput = {
    panelId: string;
    bbox: ReadingOrderBox;
};

export type BubbleReadingOrderInput = {
    bubbleId: string;
    panelId: string | null;
    bbox: ReadingOrderBox;
};

export type PageReadingOrderInput = {
    width: number;
    height: number;
    panels: PanelReadingOrderInput[];
    bubbles: BubbleReadingOrderInput[];
};

const SAME_TIER_OVERLAP_RATIO = 0.4;
const SAME_COLUMN_OVERLAP_RATIO = 0.4;

type VerticalTier<T extends { bbox: ReadingOrderBox }> = {
    items: T[];
    top: number;
    bottom: number;
    insertionOrder: number;
};

type HorizontalColumn<T extends { bbox: ReadingOrderBox }> = {
    items: T[];
    left: number;
    right: number;
    insertionOrder: number;
};

function rightEdge(box: ReadingOrderBox) {
    return box.x + box.width;
}

function bottomEdge(box: ReadingOrderBox) {
    return box.y + box.height;
}

function centerY(top: number, bottom: number) {
    return (top + bottom) / 2;
}

function centerX(left: number, right: number) {
    return (left + right) / 2;
}

function verticalOverlap(a: { top: number; bottom: number }, b: ReadingOrderBox) {
    return Math.max(0, Math.min(a.bottom, bottomEdge(b)) - Math.max(a.top, b.y));
}

function horizontalOverlap(a: { left: number; right: number }, b: ReadingOrderBox) {
    return Math.max(0, Math.min(a.right, rightEdge(b)) - Math.max(a.left, b.x));
}

function sameTier<T extends { bbox: ReadingOrderBox }>(tier: VerticalTier<T>, item: T) {
    return verticalOverlap(tier, item.bbox) >= item.bbox.height * SAME_TIER_OVERLAP_RATIO;
}

function sameColumn<T extends { bbox: ReadingOrderBox }>(column: HorizontalColumn<T>, item: T) {
    return horizontalOverlap(column, item.bbox) >= Math.min(column.right - column.left, item.bbox.width) * SAME_COLUMN_OVERLAP_RATIO;
}

function stablePanelId(item: PanelReadingOrderInput) {
    return item.panelId;
}

function stableBubbleId(item: BubbleReadingOrderInput) {
    return item.bubbleId;
}

function groupIntoVerticalTiers<T extends { bbox: ReadingOrderBox }>(
    items: T[],
    stableId: (item: T) => string,
): Array<VerticalTier<T>> {
    const sorted = [...items].sort((a, b) =>
        a.bbox.y - b.bbox.y ||
        a.bbox.x - b.bbox.x ||
        stableId(a).localeCompare(stableId(b)),
    );
    const tiers: Array<VerticalTier<T>> = [];
    for (const item of sorted) {
        const tier = tiers.find((candidate) => sameTier(candidate, item));
        if (tier) {
            tier.items.push(item);
            tier.top = Math.min(tier.top, item.bbox.y);
            tier.bottom = Math.max(tier.bottom, bottomEdge(item.bbox));
        } else {
            tiers.push({
                items: [item],
                top: item.bbox.y,
                bottom: bottomEdge(item.bbox),
                insertionOrder: tiers.length,
            });
        }
    }
    return tiers.sort((a, b) =>
        a.top - b.top ||
        centerY(a.top, a.bottom) - centerY(b.top, b.bottom) ||
        a.insertionOrder - b.insertionOrder,
    );
}

function groupIntoHorizontalColumns<T extends { bbox: ReadingOrderBox }>(
    items: T[],
    stableId: (item: T) => string,
): Array<HorizontalColumn<T>> {
    const sorted = [...items].sort((a, b) =>
        rightEdge(b.bbox) - rightEdge(a.bbox) ||
        b.bbox.x - a.bbox.x ||
        a.bbox.y - b.bbox.y ||
        stableId(a).localeCompare(stableId(b)),
    );
    const columns: Array<HorizontalColumn<T>> = [];
    for (const item of sorted) {
        const column = columns.find((candidate) => sameColumn(candidate, item));
        if (column) {
            column.items.push(item);
            column.left = Math.min(column.left, item.bbox.x);
            column.right = Math.max(column.right, rightEdge(item.bbox));
        } else {
            columns.push({
                items: [item],
                left: item.bbox.x,
                right: rightEdge(item.bbox),
                insertionOrder: columns.length,
            });
        }
    }
    return columns.sort((a, b) =>
        b.right - a.right ||
        centerX(b.left, b.right) - centerX(a.left, a.right) ||
        a.insertionOrder - b.insertionOrder,
    );
}

function sortPanelsInTier(items: PanelReadingOrderInput[]) {
    return [...items].sort((a, b) =>
        rightEdge(b.bbox) - rightEdge(a.bbox) ||
        b.bbox.x - a.bbox.x ||
        a.bbox.y - b.bbox.y ||
        stablePanelId(a).localeCompare(stablePanelId(b)),
    );
}

function sortPageLevelBubblesInTier(items: BubbleReadingOrderInput[]) {
    return [...items].sort((a, b) =>
        rightEdge(b.bbox) - rightEdge(a.bbox) ||
        a.bbox.y - b.bbox.y ||
        stableBubbleId(a).localeCompare(stableBubbleId(b)),
    );
}

function sortBubblesInColumn(items: BubbleReadingOrderInput[]) {
    return [...items].sort((a, b) =>
        a.bbox.y - b.bbox.y ||
        rightEdge(b.bbox) - rightEdge(a.bbox) ||
        stableBubbleId(a).localeCompare(stableBubbleId(b)),
    );
}

export function estimatePanelReadingOrder(panels: PanelReadingOrderInput[]): string[] {
    return groupIntoVerticalTiers(panels, stablePanelId)
        .flatMap((tier) => sortPanelsInTier(tier.items))
        .map((panel) => panel.panelId);
}

export function estimateBubbleReadingOrder(page: PageReadingOrderInput): string[] {
    const panelOrder = estimatePanelReadingOrder(page.panels);
    const panelOrderRank = new Map(panelOrder.map((panelId, index) => [panelId, index]));
    const resolved = page.bubbles.filter((bubble) => bubble.panelId && panelOrderRank.has(bubble.panelId));
    const unresolved = page.bubbles.filter((bubble) => !bubble.panelId || !panelOrderRank.has(bubble.panelId));

    const resolvedOrder = panelOrder.flatMap((panelId) => {
        const bubbles = resolved.filter((bubble) => bubble.panelId === panelId);
        return groupIntoHorizontalColumns(bubbles, stableBubbleId)
            .flatMap((column) => sortBubblesInColumn(column.items))
            .map((bubble) => bubble.bubbleId);
    });

    const unresolvedOrder = groupIntoVerticalTiers(unresolved, stableBubbleId)
        .flatMap((tier) => sortPageLevelBubblesInTier(tier.items))
        .map((bubble) => bubble.bubbleId);

    return [...resolvedOrder, ...unresolvedOrder];
}
