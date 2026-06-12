import { getAdminPageImageUrl, type EpisodeData, type PageData, type PanelData } from "../../api";
import { useTranslation } from "../../i18n/I18nProvider";
import { getBubbleWarnings, type BubbleTextComparisonOverlayMap } from "../../lib/structure-review/bubbleDraft";
import { bubbleIdOf } from "../../lib/structure-review/ids";
import { bubbleReviewKey, panelReviewKey } from "../../lib/structure-review/reviewDecisions";
import type { PanelTemplate, ReviewDecision, ReviewDecisions, ReviewSummary } from "../../lib/structure-review/types";
import { PanelBubbleLists } from "./PanelBubbleLists";
import { ScriptAssist } from "./ScriptAssist";

type PageStructureSidebarProps = {
    seriesId?: string;
    episodeId: string;
    episode: EpisodeData;
    page: PageData | null;
    pageIndex: number;
    selectedPanel: PanelData | null;
    selectedPanelIndex: number | null;
    selectedBubbleIndex: number | null;
    scriptAssistText: string;
    reviewDecisions: ReviewDecisions;
    reviewSummary: ReviewSummary;
    textComparisonOverlays?: BubbleTextComparisonOverlayMap;
    onPageChange: (index: number) => void;
    onPageDisplayRefChange: (displayRef: string) => void;
    onAddPanel: () => void;
    onAddBubble: () => void;
    onApplyPanelTemplate: (template: PanelTemplate) => void;
    onClearPanels: () => void;
    onScriptAssistTextChange: (value: string) => void;
    onApplyScriptAssist: () => void;
    onSelectPanel: (index: number) => void;
    onSelectBubble: (index: number) => void;
    onSelectBubbleCandidate: (panelIndex: number | null, bubbleIndex: number) => void;
    onMovePanel: (index: number, direction: -1 | 1) => void;
    onMoveBubble: (index: number, direction: -1 | 1) => void;
    onMoveBubbleCandidate: (panelIndex: number | null, bubbleIndex: number, direction: -1 | 1) => void;
};

function pageBubblesOf(page: PageData) {
    return page.bubbles?.length ? page.bubbles : page.panels.flatMap((panel) => panel.bubbles ?? []);
}

function pendingReviewCountOf(page: PageData, reviewDecisions: ReviewDecisions) {
    const panelPending = page.panels.filter((panel) => (reviewDecisions[panelReviewKey(panel)] ?? "pending") !== "accepted").length;
    const bubblePending = pageBubblesOf(page).filter((bubble) => (reviewDecisions[bubbleReviewKey(bubble)] ?? "pending") !== "accepted").length;
    return panelPending + bubblePending;
}

function hasLocaleImage(page: PageData, locale: "ja" | "en") {
    return Boolean(page.images?.[locale]?.trim());
}

function increment(summary: ReviewSummary, decision: ReviewDecision) {
    summary[decision] += 1;
}

function reviewSummaryOf(page: PageData, reviewDecisions: ReviewDecisions) {
    const summary: ReviewSummary = { pending: 0, accepted: 0, rejected: 0 };
    page.panels.forEach((panel) => {
        increment(summary, reviewDecisions[panelReviewKey(panel)] ?? "pending");
        panel.bubbles.forEach((bubble) => increment(summary, reviewDecisions[bubbleReviewKey(bubble)] ?? "pending"));
    });
    (page.bubbles ?? [])
        .filter((bubble) => bubble.panelId === null)
        .forEach((bubble) => increment(summary, reviewDecisions[bubbleReviewKey(bubble)] ?? "pending"));
    return summary;
}

function warningCountOf(page: PageData, textComparisonOverlays?: BubbleTextComparisonOverlayMap) {
    return pageBubblesOf(page).reduce((count, bubble) => (
        count + getBubbleWarnings(page, bubble, textComparisonOverlays?.get(bubbleIdOf(bubble))).length
    ), 0);
}

export function PageStructureSidebar({
    seriesId,
    episodeId,
    episode,
    page,
    pageIndex,
    selectedPanel,
    selectedPanelIndex,
    selectedBubbleIndex,
    scriptAssistText,
    reviewDecisions,
    reviewSummary,
    textComparisonOverlays,
    onPageChange,
    onPageDisplayRefChange,
    onAddPanel,
    onAddBubble,
    onApplyPanelTemplate,
    onClearPanels,
    onScriptAssistTextChange,
    onApplyScriptAssist,
    onSelectPanel,
    onSelectBubble,
    onSelectBubbleCandidate,
    onMovePanel,
    onMoveBubble,
    onMoveBubbleCandidate,
}: PageStructureSidebarProps) {
    const { t } = useTranslation();
    const pageBubbles = page ? pageBubblesOf(page) : [];
    const pageBubbleCount = pageBubbles.length;
    const missingSourceTextCount = pageBubbles.filter((bubble) => !bubble.textOriginal.trim()).length;
    const pagePendingReviewCount = page ? pendingReviewCountOf(page, reviewDecisions) : 0;
    const pageContentStats = episode.pages.map((episodePage, index) => {
        const bubbles = pageBubblesOf(episodePage);
        const missingSourceText = bubbles.filter((bubble) => !bubble.textOriginal.trim()).length;
        const pageReviewSummary = reviewSummaryOf(episodePage, reviewDecisions);
        const warningCount = warningCountOf(episodePage, textComparisonOverlays);
        return {
            index,
            pageNumber: episodePage.pageNumber,
            displayRef: episodePage.displayRef,
            panelCount: episodePage.panels.length,
            bubbleCount: bubbles.length,
            missingSourceText,
            warningCount,
            candidateCount: pageReviewSummary.pending,
            confirmedCount: pageReviewSummary.accepted,
            rejectedCount: pageReviewSummary.rejected,
            thumbnailUrl: seriesId ? getAdminPageImageUrl(seriesId, episodeId, episodePage.pageNumber) : "",
        };
    });

    return (
        <aside className="structure-sidebar card">
            <div className="form-group">
                <label>{t("structure.sidebar.page")}</label>
                <select
                    value={pageIndex}
                    onChange={(e) => onPageChange(Number(e.target.value))}
                >
                    {episode.pages.map((p, i) => (
                        <option key={p.id} value={i}>
                            {p.displayRef ? `${p.displayRef} · ` : ""}
                            {t("structure.sidebar.pageOption", { pageNumber: p.pageNumber, panelCount: p.panels.length })}
                        </option>
                    ))}
                </select>
            </div>

            {page && (
                <div className="form-group">
                    <label>{t("structure.sidebar.displayRef")}</label>
                    <input
                        value={page.displayRef ?? ""}
                        onChange={(e) => onPageDisplayRefChange(e.target.value)}
                        placeholder="P1 / P2-a / P2-b"
                    />
                </div>
            )}

            {page && (
                <div className="page-source-summary" aria-label={t("structure.sidebar.pageSourceSummary")}>
                    <span className="badge">{t("structure.sidebar.pagePanelCount", { count: page.panels.length })}</span>
                    <span className="badge">{t("structure.sidebar.pageBubbleCount", { count: pageBubbleCount })}</span>
                    <span className={`badge ${hasLocaleImage(page, "ja") ? "badge-ok" : "badge-warn"}`}>
                        {hasLocaleImage(page, "ja") ? t("structure.sidebar.imageJaOk") : t("structure.sidebar.imageJaMissing")}
                    </span>
                    <span className={`badge ${hasLocaleImage(page, "en") ? "badge-ok" : "badge-warn"}`}>
                        {hasLocaleImage(page, "en") ? t("structure.sidebar.imageEnOk") : t("structure.sidebar.imageEnMissing")}
                    </span>
                    <span className={`badge ${missingSourceTextCount ? "badge-warn" : "badge-ok"}`}>
                        {t("structure.sidebar.pageMissingSourceText", { count: missingSourceTextCount })}
                    </span>
                    <span className={`badge ${pagePendingReviewCount ? "badge-warn" : "badge-ok"}`}>
                        {pagePendingReviewCount
                            ? t("structure.sidebar.pagePendingReview", { count: pagePendingReviewCount })
                            : t("structure.sidebar.pageReviewOk")}
                    </span>
                </div>
            )}

            <details className="page-content-overview page-review-overview" open>
                <summary>{t("structure.sidebar.pageReviewOverview")}</summary>
                <div className="page-review-grid">
                    {pageContentStats.map((stat) => (
                        <button
                            key={`${stat.pageNumber}-${stat.index}`}
                            type="button"
                            className={`page-review-card ${pageIndex === stat.index ? "is-active" : ""}`}
                            onClick={() => onPageChange(stat.index)}
                            aria-label={t("structure.sidebar.openPageReview", { pageNumber: stat.pageNumber })}
                        >
                            <span className="page-review-thumb" aria-hidden="true">
                                {stat.thumbnailUrl
                                    ? <img src={stat.thumbnailUrl} alt="" loading="lazy" />
                                    : <span className="page-review-thumb-empty">{t("structure.sidebar.noThumbnail")}</span>}
                            </span>
                            <span className="page-review-card-body">
                                <strong>
                                    {stat.displayRef ? `${stat.displayRef} · ` : ""}
                                    {t("structure.sidebar.pageContentRow", { pageNumber: stat.pageNumber })}
                                </strong>
                                <span className="page-review-counts">
                                    <span>{t("structure.sidebar.pagePanelCount", { count: stat.panelCount })}</span>
                                    <span>{t("structure.sidebar.pageBubbleCount", { count: stat.bubbleCount })}</span>
                                </span>
                                <span className="page-review-badges">
                                    {stat.candidateCount > 0 && <span className="badge badge-warn">{t("structure.reviewState.candidate")} {stat.candidateCount}</span>}
                                    {stat.confirmedCount > 0 && <span className="badge badge-ok">{t("structure.reviewState.confirmed")} {stat.confirmedCount}</span>}
                                    {stat.rejectedCount > 0 && <span className="badge badge-muted">{t("structure.reviewState.rejected")} {stat.rejectedCount}</span>}
                                    {stat.warningCount > 0 && <span className="badge badge-err">{t("structure.reviewState.needs_review")} {stat.warningCount}</span>}
                                    {stat.missingSourceText > 0 && <span className="badge badge-warn">{t("structure.sidebar.sourceMissingShort", { count: stat.missingSourceText })}</span>}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            </details>

            <div className="review-summary">
                <span className="badge badge-warn">{t("structure.sidebar.pending", { count: reviewSummary.pending })}</span>
                <span className="badge badge-ok">{t("structure.sidebar.accepted", { count: reviewSummary.accepted })}</span>
            </div>

            <div className="structure-toolbar">
                <button type="button" className="btn btn-outline" onClick={onAddPanel}>{t("structure.sidebar.addPanel")}</button>
                <button type="button" className="btn btn-outline" onClick={onAddBubble} disabled={!page}>{t("structure.sidebar.addBubble")}</button>
            </div>
            <p className="card-meta panel-optional-note">{t("structure.sidebar.panelOptionalNote")}</p>

            <h2>{t("structure.sidebar.panelTemplates")}</h2>
            <div className="template-grid">
                <button type="button" className="template-button" onClick={() => onApplyPanelTemplate("two-one-two")}>
                    <strong>2 / 1 / 2</strong>
                    <span>ネーム標準</span>
                </button>
                <button type="button" className="template-button" onClick={() => onApplyPanelTemplate("one-one-two")}>
                    <strong>1 / 1 / 2</strong>
                    <span>横長中心</span>
                </button>
                <button type="button" className="template-button" onClick={() => onApplyPanelTemplate("three-rows")}>
                    <strong>3 rows</strong>
                    <span>横3段</span>
                </button>
                <button type="button" className="template-button" onClick={() => onApplyPanelTemplate("six-plus-wide")}>
                    <strong>3×2 + wide</strong>
                    <span>多コマ</span>
                </button>
            </div>
            <button type="button" className="btn btn-outline danger-lite" onClick={onClearPanels} disabled={!page?.panels.length}>
                {t("structure.sidebar.clear")}
            </button>

            <ScriptAssist
                value={scriptAssistText}
                disabled={selectedPanelIndex === null}
                onChange={onScriptAssistTextChange}
                onApply={onApplyScriptAssist}
            />

            <PanelBubbleLists
                page={page}
                panels={page?.panels ?? []}
                selectedPanel={selectedPanel}
                selectedPanelIndex={selectedPanelIndex}
                selectedBubbleIndex={selectedBubbleIndex}
                reviewDecisions={reviewDecisions}
                textComparisonOverlays={textComparisonOverlays}
                onSelectPanel={onSelectPanel}
                onSelectBubble={onSelectBubble}
                onSelectBubbleCandidate={onSelectBubbleCandidate}
                onMovePanel={onMovePanel}
                onMoveBubble={onMoveBubble}
                onMoveBubbleCandidate={onMoveBubbleCandidate}
            />
        </aside>
    );
}
