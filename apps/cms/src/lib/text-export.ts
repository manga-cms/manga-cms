import type { BubbleData, EpisodeData, PageData, PanelData } from "../api";

export type TextExportEpisode = Pick<EpisodeData, "id" | "title" | "pages">;

export interface TextExportInput {
    seriesId: string;
    seriesTitle?: string;
    episode: TextExportEpisode;
}

type BubbleLike = BubbleData & {
    readingOrder?: number | null;
    reading_order?: number | null;
};

type SortablePage = PageData & {
    pageNumber?: number | null;
};

type SortablePanel = PanelData & {
    panelNumber?: number | null;
};

function pageIdOf(page: { id?: string; pageId?: string }) {
    return page.pageId ?? page.id ?? "";
}

function panelIdOf(panel: { id?: string; panelId?: string }) {
    return panel.panelId ?? panel.id ?? "";
}

function bubbleIdOf(bubble: { id?: string; bubbleId?: string }) {
    return bubble.bubbleId ?? bubble.id ?? "";
}

function refOf(input: { displayRef?: string; shortId?: string; id?: string; pageId?: string; panelId?: string; bubbleId?: string }) {
    return input.displayRef ?? input.shortId ?? input.bubbleId ?? input.panelId ?? input.pageId ?? input.id ?? "";
}

function sortNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function compareTextExportRefs(a: string, b: string) {
    return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

function comparePages(a: SortablePage, b: SortablePage) {
    return sortNumber(a.pageNumber) - sortNumber(b.pageNumber)
        || compareTextExportRefs(a.displayRef ?? "", b.displayRef ?? "")
        || compareTextExportRefs(pageIdOf(a), pageIdOf(b));
}

function comparePanels(a: SortablePanel, b: SortablePanel) {
    return sortNumber(a.panelNumber) - sortNumber(b.panelNumber)
        || compareTextExportRefs(a.displayRef ?? "", b.displayRef ?? "")
        || compareTextExportRefs(panelIdOf(a), panelIdOf(b));
}

function readingOrderOf(bubble: BubbleLike) {
    return bubble.readingOrder ?? bubble.reading_order;
}

function compareBubbles(a: BubbleLike, b: BubbleLike) {
    return sortNumber(readingOrderOf(a)) - sortNumber(readingOrderOf(b))
        || sortNumber(a.bubbleNumber) - sortNumber(b.bubbleNumber)
        || compareTextExportRefs(a.displayRef ?? "", b.displayRef ?? "")
        || compareTextExportRefs(bubbleIdOf(a), bubbleIdOf(b));
}

function speakerIsSet(speaker: unknown): speaker is string {
    return typeof speaker === "string" && speaker.trim() !== "" && speaker.trim().toLowerCase() !== "unknown";
}

function formatMarkdownBubbleText(bubble: BubbleLike) {
    const text = typeof bubble.textOriginal === "string" ? bubble.textOriginal : "";
    if (text.trim() === "") {
        return speakerIsSet(bubble.speaker) ? `${bubble.speaker.trim()}: [textOriginal未入力]` : "[textOriginal未入力]";
    }
    return speakerIsSet(bubble.speaker) ? `${bubble.speaker.trim()}「${text}」` : `「${text}」`;
}

function pageBubbles(page: PageData): BubbleLike[] {
    if (Array.isArray(page.bubbles) && page.bubbles.length > 0) {
        return page.bubbles as BubbleLike[];
    }
    return (page.panels ?? []).flatMap((panel) => panel.bubbles ?? []) as BubbleLike[];
}

function panelKey(panel: PanelData) {
    return panelIdOf(panel);
}

function bubblePanelKey(bubble: BubbleLike) {
    return bubble.panelId ?? null;
}

export function serializeEpisodeTextToMarkdown({ seriesId, seriesTitle, episode }: TextExportInput) {
    const title = `${seriesTitle?.trim() || seriesId} / ${episode.title?.trim() || episode.id}`;
    const lines: string[] = [`# ${title}`, ""];
    const pages = [...(episode.pages ?? [])].sort(comparePages);

    pages.forEach((page, pageIndex) => {
        if (pageIndex > 0) lines.push("");
        lines.push(`## ${refOf(page)}`);
        const bubbles = [...pageBubbles(page)].sort(compareBubbles);
        if (bubbles.length === 0) {
            lines.push("", "テキストなし");
            return;
        }

        const panels = [...(page.panels ?? [])].sort(comparePanels);
        const resolvedPanelIds = new Set(panels.map(panelKey));
        let wrotePanel = false;
        panels.forEach((panel) => {
            const panelBubbles = bubbles.filter((bubble) => bubblePanelKey(bubble) === panelKey(panel));
            if (panelBubbles.length === 0) return;
            if (wrotePanel) lines.push("");
            lines.push("", `### ${refOf(panel)}`);
            panelBubbles.forEach((bubble) => {
                lines.push(`- ${refOf(bubble)}: ${formatMarkdownBubbleText(bubble)}`);
            });
            wrotePanel = true;
        });

        const unresolvedBubbles = bubbles.filter((bubble) => {
            const panelId = bubblePanelKey(bubble);
            return !panelId || !resolvedPanelIds.has(panelId);
        });
        if (unresolvedBubbles.length > 0) {
            if (wrotePanel) lines.push("");
            lines.push("", "### Panel未設定");
            unresolvedBubbles.forEach((bubble) => {
                lines.push(`- ${refOf(bubble)}: ${formatMarkdownBubbleText(bubble)}`);
            });
        }
    });

    return `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n")}\n`;
}

function tsvEscape(value: unknown) {
    if (value === undefined || value === null) return "";
    return String(value).replace(/\t/g, "\\t").replace(/\r\n/g, "\\n").replace(/\r/g, "\\n").replace(/\n/g, "\\n");
}

export function serializeEpisodeTextToTsv({ seriesId, episode }: TextExportInput) {
    const columns = [
        "series_id",
        "episode_id",
        "page_id",
        "panel_id",
        "bubble_id",
        "page_display_ref",
        "panel_display_ref",
        "bubble_display_ref",
        "bubble_short_id",
        "page_number",
        "panel_number",
        "bubble_number",
        "reading_order",
        "speaker",
        "text_direction",
        "bubble_type",
        "text_original",
    ];
    const rows = [columns.join("\t")];

    [...(episode.pages ?? [])].sort(comparePages).forEach((page) => {
        const panels = [...(page.panels ?? [])].sort(comparePanels);
        const panelById = new Map(panels.map((panel) => [panelKey(panel), panel]));
        [...pageBubbles(page)].sort(compareBubbles).forEach((bubble) => {
            const panel = bubblePanelKey(bubble) ? panelById.get(bubblePanelKey(bubble) ?? "") : undefined;
            rows.push([
                seriesId,
                episode.id,
                pageIdOf(page),
                panel ? panelKey(panel) : bubblePanelKey(bubble) ?? "",
                bubbleIdOf(bubble),
                page.displayRef ?? "",
                panel?.displayRef ?? "",
                bubble.displayRef ?? "",
                bubble.shortId ?? "",
                page.pageNumber ?? "",
                panel?.panelNumber ?? "",
                bubble.bubbleNumber ?? "",
                readingOrderOf(bubble) ?? "",
                bubble.speaker ?? "",
                bubble.textDirection ?? "",
                bubble.bubbleType ?? "",
                bubble.textOriginal ?? "",
            ].map(tsvEscape).join("\t"));
        });
    });

    return `${rows.join("\n")}\n`;
}
