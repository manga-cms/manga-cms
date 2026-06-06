import type { BubbleData, PageData, PanelData, ProposalCreateInput } from "../../api";
import { getBubbleSourceText } from "./bubbleDraft";
import { bubbleIdOf, panelIdOf } from "./ids";

const LOCAL_TRANSLATION_PROPOSAL_KEY = "manga-cms:translation-workspace:proposal-drafts";

export type TranslationBubbleContext = {
    id: string;
    label: string;
    text: string;
    isSelected: boolean;
};

export type LocalTranslationProposalDraft = ProposalCreateInput & {
    id: string;
    createdAt: string;
};

function optionalString(value: unknown) {
    return typeof value === "string" ? value : "";
}

export function getBubbleCurrentTranslation(bubble: BubbleData) {
    const record = bubble as unknown as Record<string, unknown>;
    return optionalString(record.currentTranslation)
        || optionalString(record.current_translation)
        || optionalString(record.textTranslated)
        || optionalString(record.translation);
}

export function buildBubbleTranslationContext(page: PageData | null, selectedBubble: BubbleData | null): TranslationBubbleContext[] {
    if (!page || !selectedBubble) return [];
    const selectedId = bubbleIdOf(selectedBubble);
    const bubbles = page.panels.flatMap((panel: PanelData) => panel.bubbles.map((bubble) => ({
        id: bubbleIdOf(bubble),
        label: bubble.displayRef ?? bubble.shortId ?? `Bubble ${bubble.bubbleNumber}`,
        text: getBubbleSourceText(bubble),
        isSelected: bubbleIdOf(bubble) === selectedId,
    })));
    const selectedIndex = bubbles.findIndex((bubble) => bubble.id === selectedId);
    if (selectedIndex < 0) return [];
    return bubbles.slice(Math.max(0, selectedIndex - 2), selectedIndex + 3);
}

export function storeLocalTranslationProposalDraft(input: Omit<LocalTranslationProposalDraft, "id" | "createdAt">) {
    const draft: LocalTranslationProposalDraft = {
        ...input,
        id: `local-translation-proposal-${Date.now()}`,
        createdAt: new Date().toISOString(),
    };
    try {
        const raw = window.localStorage.getItem(LOCAL_TRANSLATION_PROPOSAL_KEY);
        const current = raw ? JSON.parse(raw) as LocalTranslationProposalDraft[] : [];
        window.localStorage.setItem(LOCAL_TRANSLATION_PROPOSAL_KEY, JSON.stringify([draft, ...current].slice(0, 50)));
    } catch {
        // The API endpoint is not available yet; local draft persistence is best-effort.
    }
    return draft;
}

export function makeTranslationProposalDraftInput({
    seriesId,
    episodeId,
    page,
    panel,
    bubble,
    suggestedText,
    comment,
}: {
    seriesId?: string;
    episodeId?: string;
    page: PageData;
    panel: PanelData;
    bubble: BubbleData;
    suggestedText: string;
    comment?: string;
}): ProposalCreateInput {
    return {
        kind: "translation",
        status: "new",
        series_id: seriesId ?? "",
        episode_id: episodeId ?? "",
        page_id: page.pageId ?? page.id,
        panel_id: panelIdOf(panel),
        bubble_id: bubbleIdOf(bubble),
        lang: bubble.lang ?? "ja",
        current_text: getBubbleSourceText(bubble),
        current_translation: getBubbleCurrentTranslation(bubble),
        suggested_text: suggestedText.trim(),
        ...(comment?.trim() && { comment: comment.trim() }),
        ...(typeof window !== "undefined" && { source_url: window.location.href }),
    };
}
