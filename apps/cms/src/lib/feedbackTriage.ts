import type { BubbleData, EpisodeData, FeedbackRecord, PanelData, ProposalRecord } from "../api";

export type FeedbackTargetKind = "episode" | "page" | "panel" | "bubble";
export type FeedbackIdentityFilter = "all" | "anonymous" | "display_name" | "github_login" | "user_id";

export type FeedbackTargetContext = {
    kind: FeedbackTargetKind;
    page?: EpisodeData["pages"][number];
    panel?: PanelData;
    bubble?: BubbleData;
};

export function feedbackTargetKind(record: FeedbackRecord): FeedbackTargetKind {
    if (record.bubble_id) return "bubble";
    if (record.panel_id) return "panel";
    if (record.page_id) return "page";
    return "episode";
}

export function feedbackTargetLabel(record: FeedbackRecord) {
    const parts = [record.series_id, record.episode_id];
    if (record.page_id) parts.push(record.page_id);
    if (record.panel_id) parts.push(record.panel_id);
    if (record.bubble_id) parts.push(record.bubble_id);
    return parts.join(" / ");
}

export function feedbackIdentityLevel(record: FeedbackRecord): FeedbackIdentityFilter {
    if (record.contributor_identity?.identity_level) return record.contributor_identity.identity_level;
    if (record.user_id) return "user_id";
    return "anonymous";
}

export function feedbackIdentityLabel(record: FeedbackRecord) {
    const identity = record.contributor_identity;
    if (identity?.identity_level === "github_login") return `GitHub @${identity.github_login}`;
    if (identity?.identity_level === "display_name") return `表示名: ${identity.display_name}`;
    if (record.user_id) return `user: ${record.user_id}`;
    return "匿名";
}

export function formatFeedbackDate(value: string) {
    return new Date(value).toLocaleString("ja-JP");
}

function valuesOf(value: unknown) {
    return typeof value === "string" && value.trim() ? [value] : [];
}

function pageRefs(page: EpisodeData["pages"][number]) {
    return [
        ...valuesOf(page.pageId),
        ...valuesOf(page.id),
        ...valuesOf(page.stableRef),
        ...valuesOf(page.displayRef),
        `page-${page.pageNumber}`,
        `p${String(page.pageNumber).padStart(2, "0")}`,
    ];
}

function panelRefs(panel: PanelData) {
    return [
        ...valuesOf(panel.panelId),
        ...valuesOf(panel.id),
        ...valuesOf(panel.stableRef),
        ...valuesOf(panel.displayRef),
    ];
}

function bubbleRefs(bubble: BubbleData) {
    return [
        ...valuesOf(bubble.bubbleId),
        ...valuesOf(bubble.id),
        ...valuesOf(bubble.stableRef),
        ...valuesOf(bubble.displayRef),
        ...valuesOf(bubble.shortId),
    ];
}

function matchesRef(expected: string | null | undefined, refs: string[]) {
    if (!expected) return false;
    return refs.includes(expected);
}

export function resolveFeedbackTarget(record: FeedbackRecord, episode: EpisodeData | null): FeedbackTargetContext {
    const fallback: FeedbackTargetContext = { kind: feedbackTargetKind(record) };
    if (!episode) return fallback;

    const page = record.page_id
        ? episode.pages.find((candidate) => matchesRef(record.page_id, pageRefs(candidate)))
        : undefined;
    const pageScope = page ? [page] : episode.pages;
    const panels = pageScope.flatMap((candidatePage) => candidatePage.panels.map((panel) => ({ page: candidatePage, panel })));
    const panelMatch = record.panel_id
        ? panels.find(({ panel }) => matchesRef(record.panel_id, panelRefs(panel)))
        : undefined;
    const bubbleScope = pageScope.flatMap((candidatePage) => {
        const panelBubbles = candidatePage.panels.flatMap((panel) =>
            panel.bubbles.map((bubble) => ({ page: candidatePage, panel, bubble })),
        );
        const pageLevelBubbles = (candidatePage.bubbles ?? []).map((bubble) => ({
            page: candidatePage,
            panel: panels.find(({ panel }) => panel.panelId === bubble.panelId || panel.id === bubble.panelId)?.panel,
            bubble,
        }));
        return [...panelBubbles, ...pageLevelBubbles];
    });
    const bubbleMatch = record.bubble_id
        ? bubbleScope.find(({ bubble }) => matchesRef(record.bubble_id, bubbleRefs(bubble)))
        : undefined;

    if (bubbleMatch) {
        return {
            kind: "bubble",
            page: bubbleMatch.page,
            panel: bubbleMatch.panel,
            bubble: bubbleMatch.bubble,
        };
    }
    if (panelMatch) return { kind: "panel", page: panelMatch.page, panel: panelMatch.panel };
    if (page) return { kind: "page", page };
    return fallback;
}

export function sourceTextMatchesFeedback(record: FeedbackRecord, context: FeedbackTargetContext) {
    if (!context.bubble || record.current_text === undefined) return null;
    return context.bubble.textOriginal.trim() === record.current_text.trim();
}

export function findProposalForFeedback(feedbackId: string, proposals: ProposalRecord[]) {
    return proposals.find((proposal) => proposal.source_feedback_id === feedbackId) ?? null;
}
