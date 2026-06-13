import type { BubbleData, PageData, PanelData } from "../../api";
import { bubbleIdOf, makeBubbleShortId, panelIdOf } from "./ids.ts";

function normalizePanelBubble(page: PageData, panel: PanelData, bubble: BubbleData, localIndex: number): BubbleData {
    const bubbleId = bubbleIdOf(bubble);
    const panelId = panelIdOf(panel);
    const displayRef = bubble.displayRef ?? bubble.shortId ?? makeBubbleShortId(page, panel, localIndex + 1);
    return {
        ...bubble,
        id: bubble.id ?? bubbleId,
        bubbleId,
        panelId,
        stableRef: bubble.stableRef ?? bubbleId,
        displayRef,
        shortId: bubble.shortId ?? displayRef,
    };
}

function normalizePageBubble(bubble: BubbleData): BubbleData {
    const bubbleId = bubbleIdOf(bubble);
    const displayRef = bubble.displayRef ?? bubble.shortId;
    return {
        ...bubble,
        id: bubble.id ?? bubbleId,
        bubbleId,
        panelId: null,
        stableRef: bubble.stableRef ?? bubbleId,
        ...(displayRef !== undefined && { displayRef, shortId: bubble.shortId ?? displayRef }),
    };
}

/**
 * Normalize the editable Page Structure Review model after local edits.
 *
 * The CMS editor keeps assigned Bubbles on `panel.bubbles` while editing, then
 * rebuilds the canonical `page.bubbles` array from those Panel lists plus
 * `panelId: null` page-level Bubbles. Callers that start from canonical v2
 * data must first hydrate assigned Bubbles into their owning Panels; otherwise
 * panel-linked Bubbles that only exist in `page.bubbles` are intentionally not
 * treated as an edit source here.
 */
export function syncPageBubbles(page: PageData): PageData {
    const assignedBubbles = page.panels.flatMap((panel) =>
        panel.bubbles.map((bubble, index) => normalizePanelBubble(page, panel, bubble, index)),
    );
    const pageLevelBubbles = (page.bubbles ?? [])
        .filter((bubble) => bubble.panelId === null)
        .map(normalizePageBubble);
    const bubbles = [...assignedBubbles, ...pageLevelBubbles].map((bubble, index) => ({
        ...bubble,
        bubbleNumber: index + 1,
    }));

    return {
        ...page,
        bubbles,
        panels: page.panels.map((panel) => {
            const panelId = panelIdOf(panel);
            return {
                ...panel,
                bubbles: bubbles.filter((bubble) => bubble.panelId === panelId),
            };
        }),
    };
}
