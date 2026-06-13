import { estimateBubbleReadingOrder, estimatePanelReadingOrder } from "@manga/schemas/reading-order";
import type { Bubble, Page, Panel } from "@manga/domain";
import type {
    BuildTranslationPageScriptInput,
    TranslationPageScript,
    TranslationPageScriptBubble,
    TranslationPageScriptPanel,
} from "./types.js";

const DEFAULT_PROMPT_VERSION = "translation-page-v1";

function pageIdOf(page: Page): string {
    return page.pageId ?? page.id;
}

function panelIdOf(panel: Panel): string {
    return panel.panelId ?? panel.id;
}

function bubbleIdOf(bubble: Bubble): string {
    return bubble.bubbleId ?? bubble.id;
}

function isActiveStatus(status?: string): boolean {
    return status === undefined || status === "active";
}

function hasValidUniqueOrder<T>(items: T[], orderOf: (item: T) => number): boolean {
    const seen = new Set<number>();
    for (const item of items) {
        const order = orderOf(item);
        if (!Number.isFinite(order) || order <= 0 || seen.has(order)) return false;
        seen.add(order);
    }
    return true;
}

function bubbleToScriptBubble(bubble: Bubble): TranslationPageScriptBubble {
    return {
        bubbleId: bubbleIdOf(bubble),
        panelId: bubble.panelId ?? null,
        sourceText: bubble.textOriginal,
        ...(bubble.speaker && { speaker: bubble.speaker }),
        bubbleType: bubble.bubbleType,
        ...(bubble.textDirection && { textDirection: bubble.textDirection }),
    };
}

function orderedPanels(page: Page): Panel[] {
    const activePanels = page.panels.filter((panel) => isActiveStatus(panel.status));
    if (hasValidUniqueOrder(activePanels, (panel) => panel.panelNumber)) {
        return [...activePanels].sort((a, b) =>
            a.panelNumber - b.panelNumber ||
            panelIdOf(a).localeCompare(panelIdOf(b)),
        );
    }
    const panelsById = new Map(activePanels.map((panel) => [panelIdOf(panel), panel]));
    return estimatePanelReadingOrder(activePanels.map((panel) => ({
        panelId: panelIdOf(panel),
        bbox: panel.bbox,
    }))).map((panelId) => panelsById.get(panelId)).filter((panel): panel is Panel => Boolean(panel));
}

function orderedBubbles(page: Page): Bubble[] {
    const activePanels = page.panels.filter((panel) => isActiveStatus(panel.status));
    const activePanelIds = new Set(activePanels.map(panelIdOf));
    const activeBubbles = page.bubbles.filter((bubble) => isActiveStatus(bubble.status));
    if (hasValidUniqueOrder(activeBubbles, (bubble) => bubble.bubbleNumber)) {
        return [...activeBubbles].sort((a, b) =>
            a.bubbleNumber - b.bubbleNumber ||
            bubbleIdOf(a).localeCompare(bubbleIdOf(b)),
        );
    }
    const bubblesById = new Map(activeBubbles.map((bubble) => [bubbleIdOf(bubble), bubble]));
    return estimateBubbleReadingOrder({
        width: page.width,
        height: page.height,
        panels: activePanels.map((panel) => ({
            panelId: panelIdOf(panel),
            bbox: panel.bbox,
        })),
        bubbles: activeBubbles.map((bubble) => ({
            bubbleId: bubbleIdOf(bubble),
            panelId: bubble.panelId && activePanelIds.has(bubble.panelId) ? bubble.panelId : null,
            bbox: bubble.bbox,
        })),
    }).map((bubbleId) => bubblesById.get(bubbleId)).filter((bubble): bubble is Bubble => Boolean(bubble));
}

function scriptLines(script: Omit<TranslationPageScript, "text">): string[] {
    const lines: string[] = [
        `Episode: ${script.episodeId}`,
        `Page: ${script.pageId} (#${script.pageNumber})`,
        `Source locale: ${script.sourceLocale}`,
        `Target locale: ${script.targetLocale}`,
        "",
        "Translate each Bubble. Return output keyed by bubbleId. Do not invent, remove, or rename bubbleIds.",
    ];

    if (script.glossary.length > 0) {
        lines.push("", "Glossary:");
        script.glossary.forEach((term) => {
            lines.push(`- ${term.source} => ${term.target}${term.note ? ` (${term.note})` : ""}`);
        });
    }

    if (script.characterVoices.length > 0) {
        lines.push("", "Character voices:");
        script.characterVoices.forEach((voice) => {
            lines.push(`- ${voice.speaker}: ${voice.note}`);
        });
    }

    lines.push("", "Panels and Bubbles:");
    script.panels.forEach((panel, index) => {
        lines.push(`[Panel ${index + 1}: ${panel.panelId}${panel.displayRef ? ` / ${panel.displayRef}` : ""}]`);
        panel.bubbles.forEach((bubble) => {
            const speaker = bubble.speaker ? ` speaker=${bubble.speaker}` : "";
            lines.push(`- bubbleId=${bubble.bubbleId} type=${bubble.bubbleType}${speaker}: ${bubble.sourceText}`);
        });
    });

    if (script.pageLevelBubbles.length > 0) {
        lines.push("[Page-level Bubbles]");
        script.pageLevelBubbles.forEach((bubble) => {
            const speaker = bubble.speaker ? ` speaker=${bubble.speaker}` : "";
            lines.push(`- bubbleId=${bubble.bubbleId} type=${bubble.bubbleType}${speaker}: ${bubble.sourceText}`);
        });
    }

    return lines;
}

export function buildTranslationPageScript(input: BuildTranslationPageScriptInput): TranslationPageScript {
    const pageId = pageIdOf(input.page);
    const panels = orderedPanels(input.page);
    const panelOrder = panels.map(panelIdOf);
    const panelRank = new Map(panelOrder.map((panelId, index) => [panelId, index]));
    const bubbles = orderedBubbles(input.page);
    const panelBubbles = new Map<string, TranslationPageScriptBubble[]>();
    const pageLevelBubbles: TranslationPageScriptBubble[] = [];

    bubbles.forEach((bubble) => {
        const scriptBubble = bubbleToScriptBubble(bubble);
        if (scriptBubble.panelId && panelRank.has(scriptBubble.panelId)) {
            const current = panelBubbles.get(scriptBubble.panelId) ?? [];
            current.push(scriptBubble);
            panelBubbles.set(scriptBubble.panelId, current);
        } else {
            pageLevelBubbles.push({ ...scriptBubble, panelId: null });
        }
    });

    const scriptPanels: TranslationPageScriptPanel[] = panels.map((panel) => ({
        panelId: panelIdOf(panel),
        ...(panel.displayRef && { displayRef: panel.displayRef }),
        bubbles: panelBubbles.get(panelIdOf(panel)) ?? [],
    }));

    const scriptWithoutText: Omit<TranslationPageScript, "text"> = {
        episodeId: input.episode.id,
        pageId,
        pageNumber: input.page.pageNumber,
        sourceLocale: input.sourceLocale ?? "ja",
        targetLocale: input.targetLocale,
        promptVersion: input.promptVersion ?? DEFAULT_PROMPT_VERSION,
        panelOrder,
        bubbleOrder: bubbles.map(bubbleIdOf),
        panels: scriptPanels,
        pageLevelBubbles,
        glossary: input.glossary ?? [],
        characterVoices: input.characterVoices ?? [],
    };

    return {
        ...scriptWithoutText,
        text: scriptLines(scriptWithoutText).join("\n"),
    };
}
