import type { BubbleData, EpisodeData, PageData, PanelData } from "../../api";
import { bubbleIdOf, panelIdOf } from "./ids";
import type { ReviewDecision, ReviewDecisions, ReviewSummary } from "./types";

export function panelReviewKey(panel: PanelData) {
    return `panel:${panelIdOf(panel)}`;
}

export function bubbleReviewKey(bubble: BubbleData) {
    return `bubble:${bubbleIdOf(bubble)}`;
}

export function seedAcceptedDecisions(episode: EpisodeData): ReviewDecisions {
    const decisions: ReviewDecisions = {};
    episode.pages.forEach((page) => {
        page.panels.forEach((panel) => {
            decisions[panelReviewKey(panel)] = "accepted";
            panel.bubbles.forEach((bubble) => {
                decisions[bubbleReviewKey(bubble)] = "accepted";
            });
        });
        (page.bubbles ?? [])
            .filter((bubble) => bubble.panelId === null)
            .forEach((bubble) => {
                decisions[bubbleReviewKey(bubble)] = "accepted";
            });
    });
    return decisions;
}

export function markPanels(decisions: ReviewDecisions, panels: PanelData[], decision: ReviewDecision) {
    const next = { ...decisions };
    panels.forEach((panel) => {
        next[panelReviewKey(panel)] = decision;
        panel.bubbles.forEach((bubble) => {
            next[bubbleReviewKey(bubble)] = decision;
        });
    });
    return next;
}

export function summarizeReview(page: PageData | null, reviewDecisions: ReviewDecisions): ReviewSummary {
    if (!page) return { pending: 0, accepted: 0, rejected: 0 };
    const summary = page.panels.reduce((acc, panel) => {
        acc[reviewDecisions[panelReviewKey(panel)] ?? "pending"] += 1;
        panel.bubbles.forEach((bubble) => {
            acc[reviewDecisions[bubbleReviewKey(bubble)] ?? "pending"] += 1;
        });
        return acc;
    }, { pending: 0, accepted: 0, rejected: 0 } as ReviewSummary);
    (page.bubbles ?? [])
        .filter((bubble) => bubble.panelId === null)
        .forEach((bubble) => {
            summary[reviewDecisions[bubbleReviewKey(bubble)] ?? "pending"] += 1;
        });
    return summary;
}
