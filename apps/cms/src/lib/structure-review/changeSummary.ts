import type { BubbleData, EpisodeData, PageData, PanelData } from "../../api";
import { bubbleIdOf, panelIdOf } from "./ids";
import { bubbleReviewKey, panelReviewKey } from "./reviewDecisions";
import type { ReviewDecisions } from "./types";

export type StructureChangeEntity = "page" | "panel" | "bubble" | "review";

export type StructureChangeField =
    | "pageDisplayRef"
    | "panelAdded"
    | "panelRemoved"
    | "panelBbox"
    | "panelReadingOrder"
    | "bubbleAdded"
    | "bubbleRemoved"
    | "bubbleBbox"
    | "sourceText"
    | "speaker"
    | "bubbleType"
    | "textDirection"
    | "readingOrder"
    | "reviewDecision";

export type StructureChangeItem = {
    key: string;
    entity: StructureChangeEntity;
    field: StructureChangeField;
    label: string;
    before?: string;
    after?: string;
};

export type StructureChangeSummary = {
    changes: StructureChangeItem[];
    total: number;
};

function pageIdOf(page: PageData) {
    return page.pageId ?? page.id;
}

function bubbleListOf(page: PageData) {
    return page.bubbles?.length ? page.bubbles : page.panels.flatMap((panel) => panel.bubbles ?? []);
}

function byId<T>(items: T[], getId: (item: T) => string) {
    const map = new Map<string, T>();
    items.forEach((item) => map.set(getId(item), item));
    return map;
}

function formatBbox(box: { x: number; y: number; width: number; height: number }) {
    return `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`;
}

function valueOrUnset(value: string | undefined | null) {
    return value?.trim() ? value : "";
}

function pageLabel(page: PageData) {
    return page.displayRef ? `${page.displayRef} / Page ${page.pageNumber}` : `Page ${page.pageNumber}`;
}

function panelLabel(page: PageData, panel: PanelData) {
    return `${pageLabel(page)} / Panel ${panel.panelNumber}`;
}

function bubbleLabel(page: PageData, bubble: BubbleData) {
    const ref = bubble.displayRef ?? bubble.shortId ?? bubbleIdOf(bubble);
    return `${pageLabel(page)} / Bubble ${bubble.bubbleNumber}${ref ? ` (${ref})` : ""}`;
}

function addChange(
    changes: StructureChangeItem[],
    change: Omit<StructureChangeItem, "key">,
) {
    changes.push({
        ...change,
        key: `${change.entity}:${change.field}:${change.label}:${change.before ?? ""}:${change.after ?? ""}`,
    });
}

function compareValue(
    changes: StructureChangeItem[],
    args: {
        entity: StructureChangeEntity;
        field: StructureChangeField;
        label: string;
        before?: string;
        after?: string;
    },
) {
    if ((args.before ?? "") === (args.after ?? "")) return;
    addChange(changes, args);
}

function comparePanels(changes: StructureChangeItem[], beforePage: PageData, afterPage: PageData) {
    const beforePanels = byId(beforePage.panels, panelIdOf);
    const afterPanels = byId(afterPage.panels, panelIdOf);
    const panelIds = new Set([...beforePanels.keys(), ...afterPanels.keys()]);

    panelIds.forEach((panelId) => {
        const beforePanel = beforePanels.get(panelId);
        const afterPanel = afterPanels.get(panelId);
        if (!beforePanel && afterPanel) {
            addChange(changes, {
                entity: "panel",
                field: "panelAdded",
                label: panelLabel(afterPage, afterPanel),
                after: formatBbox(afterPanel.bbox),
            });
            return;
        }
        if (beforePanel && !afterPanel) {
            addChange(changes, {
                entity: "panel",
                field: "panelRemoved",
                label: panelLabel(beforePage, beforePanel),
                before: formatBbox(beforePanel.bbox),
            });
            return;
        }
        if (!beforePanel || !afterPanel) return;
        compareValue(changes, {
            entity: "panel",
            field: "panelReadingOrder",
            label: panelLabel(afterPage, afterPanel),
            before: String(beforePanel.panelNumber),
            after: String(afterPanel.panelNumber),
        });
        compareValue(changes, {
            entity: "panel",
            field: "panelBbox",
            label: panelLabel(afterPage, afterPanel),
            before: formatBbox(beforePanel.bbox),
            after: formatBbox(afterPanel.bbox),
        });
    });
}

function compareBubbles(changes: StructureChangeItem[], beforePage: PageData, afterPage: PageData) {
    const beforeBubbles = byId(bubbleListOf(beforePage), bubbleIdOf);
    const afterBubbles = byId(bubbleListOf(afterPage), bubbleIdOf);
    const bubbleIds = new Set([...beforeBubbles.keys(), ...afterBubbles.keys()]);

    bubbleIds.forEach((bubbleId) => {
        const beforeBubble = beforeBubbles.get(bubbleId);
        const afterBubble = afterBubbles.get(bubbleId);
        if (!beforeBubble && afterBubble) {
            addChange(changes, {
                entity: "bubble",
                field: "bubbleAdded",
                label: bubbleLabel(afterPage, afterBubble),
                after: afterBubble.textOriginal || formatBbox(afterBubble.bbox),
            });
            return;
        }
        if (beforeBubble && !afterBubble) {
            addChange(changes, {
                entity: "bubble",
                field: "bubbleRemoved",
                label: bubbleLabel(beforePage, beforeBubble),
                before: beforeBubble.textOriginal || formatBbox(beforeBubble.bbox),
            });
            return;
        }
        if (!beforeBubble || !afterBubble) return;
        compareValue(changes, {
            entity: "bubble",
            field: "readingOrder",
            label: bubbleLabel(afterPage, afterBubble),
            before: String(beforeBubble.bubbleNumber),
            after: String(afterBubble.bubbleNumber),
        });
        compareValue(changes, {
            entity: "bubble",
            field: "bubbleBbox",
            label: bubbleLabel(afterPage, afterBubble),
            before: formatBbox(beforeBubble.bbox),
            after: formatBbox(afterBubble.bbox),
        });
        compareValue(changes, {
            entity: "bubble",
            field: "sourceText",
            label: bubbleLabel(afterPage, afterBubble),
            before: beforeBubble.textOriginal,
            after: afterBubble.textOriginal,
        });
        compareValue(changes, {
            entity: "bubble",
            field: "speaker",
            label: bubbleLabel(afterPage, afterBubble),
            before: valueOrUnset(beforeBubble.speaker),
            after: valueOrUnset(afterBubble.speaker),
        });
        compareValue(changes, {
            entity: "bubble",
            field: "bubbleType",
            label: bubbleLabel(afterPage, afterBubble),
            before: beforeBubble.bubbleType,
            after: afterBubble.bubbleType,
        });
        compareValue(changes, {
            entity: "bubble",
            field: "textDirection",
            label: bubbleLabel(afterPage, afterBubble),
            before: valueOrUnset(beforeBubble.textDirection),
            after: valueOrUnset(afterBubble.textDirection),
        });
    });
}

function compareReviewDecisions(changes: StructureChangeItem[], before: ReviewDecisions, after: ReviewDecisions) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    keys.forEach((key) => {
        const beforeDecision = before[key] ?? "pending";
        const afterDecision = after[key] ?? "pending";
        if (beforeDecision === afterDecision) return;
        addChange(changes, {
            entity: "review",
            field: "reviewDecision",
            label: key,
            before: beforeDecision,
            after: afterDecision,
        });
    });
}

export function summarizeStructureChanges(
    beforeEpisode: EpisodeData | null,
    afterEpisode: EpisodeData | null,
    beforeReviewDecisions: ReviewDecisions,
    afterReviewDecisions: ReviewDecisions,
): StructureChangeSummary {
    if (!beforeEpisode || !afterEpisode) return { changes: [], total: 0 };
    const changes: StructureChangeItem[] = [];
    const beforePages = byId(beforeEpisode.pages, pageIdOf);
    const afterPages = byId(afterEpisode.pages, pageIdOf);
    const pageIds = new Set([...beforePages.keys(), ...afterPages.keys()]);

    pageIds.forEach((pageId) => {
        const beforePage = beforePages.get(pageId);
        const afterPage = afterPages.get(pageId);
        if (!beforePage && afterPage) {
            addChange(changes, {
                entity: "page",
                field: "pageDisplayRef",
                label: pageLabel(afterPage),
                after: afterPage.displayRef ?? "",
            });
            return;
        }
        if (beforePage && !afterPage) {
            addChange(changes, {
                entity: "page",
                field: "pageDisplayRef",
                label: pageLabel(beforePage),
                before: beforePage.displayRef ?? "",
            });
            return;
        }
        if (!beforePage || !afterPage) return;
        compareValue(changes, {
            entity: "page",
            field: "pageDisplayRef",
            label: pageLabel(afterPage),
            before: beforePage.displayRef ?? "",
            after: afterPage.displayRef ?? "",
        });
        comparePanels(changes, beforePage, afterPage);
        compareBubbles(changes, beforePage, afterPage);
    });

    compareReviewDecisions(changes, beforeReviewDecisions, afterReviewDecisions);

    return {
        changes,
        total: changes.length,
    };
}
