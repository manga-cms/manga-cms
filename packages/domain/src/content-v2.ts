import type { Bubble, Episode, Page, Panel } from "./types.js";

type LegacyPanel = Panel & { bubbles?: Bubble[] };
type LegacyPage = Omit<Page, "panels" | "bubbles"> & {
    panels?: LegacyPanel[];
    bubbles?: Bubble[];
};
export type PanelWithBubbles = Panel & { bubbles: Bubble[] };
export type PageWithPanelBubbles = Omit<Page, "panels"> & { panels: PanelWithBubbles[] };
export type EpisodeWithPanelBubbles = Omit<Episode, "pages"> & { pages: PageWithPanelBubbles[] };

export function pageIdOf(page: Pick<Page, "pageId" | "id">): string {
    return page.pageId ?? page.id;
}

export function panelIdOf(panel: Pick<Panel, "panelId" | "id">): string {
    return panel.panelId ?? panel.id;
}

export function bubbleIdOf(bubble: Pick<Bubble, "bubbleId" | "id">): string {
    return bubble.bubbleId ?? bubble.id;
}

export function getPanelBubbles(page: Page, panel: Panel): Bubble[] {
    const panelId = panelIdOf(panel);
    return (page.bubbles ?? []).filter((bubble) => bubble.panelId === panelId);
}

export function getUnassignedBubbles(page: Page): Bubble[] {
    return (page.bubbles ?? []).filter((bubble) => bubble.panelId === null);
}

export function attachPanelBubbles(page: Page): PageWithPanelBubbles {
    return {
        ...page,
        panels: (page.panels ?? []).map((panel) => ({
            ...panel,
            bubbles: getPanelBubbles(page, panel),
        })),
    };
}

export function attachEpisodePanelBubbles<T extends Episode>(episode: T): T & EpisodeWithPanelBubbles {
    return {
        ...episode,
        pages: (episode.pages ?? []).map(attachPanelBubbles),
    } as T & EpisodeWithPanelBubbles;
}

export function migrateLegacyPageBubbles<T extends LegacyPage>(page: T): Page {
    const panels = (page.panels ?? []).map((panel) => {
        const { bubbles: _legacyBubbles, ...nextPanel } = panel;
        return nextPanel;
    }) as Panel[];
    const liftedBubbles = (page.panels ?? []).flatMap((panel) => {
        const panelId = panelIdOf(panel);
        return (panel.bubbles ?? []).map((bubble) => ({
            ...bubble,
            panelId: bubble.panelId ?? panelId,
        }));
    });

    const bubbleById = new Map<string, Bubble>();
    for (const bubble of [...(page.bubbles ?? []), ...liftedBubbles]) {
        bubbleById.set(bubbleIdOf(bubble), bubble);
    }

    const bubbles = [...bubbleById.values()].map((bubble, index) => ({
        ...bubble,
        bubbleNumber: index + 1,
    }));

    return {
        ...page,
        panels,
        bubbles,
    } as Page;
}

export function migrateLegacyEpisodeBubbles<T extends Episode>(episode: T): T {
    return {
        ...episode,
        pages: (episode.pages ?? []).map((page) => migrateLegacyPageBubbles(page as LegacyPage)),
    };
}
