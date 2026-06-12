import type { EpisodeData, PageData, PanelData } from "../../api";
import { useTranslation } from "../../i18n/I18nProvider";
import type { BubbleTextComparisonOverlayMap } from "../../lib/structure-review/bubbleDraft";
import { bubbleReviewKey, panelReviewKey } from "../../lib/structure-review/reviewDecisions";
import type { PanelTemplate, ReviewDecisions, ReviewSummary } from "../../lib/structure-review/types";
import { PanelBubbleLists } from "./PanelBubbleLists";
import { ScriptAssist } from "./ScriptAssist";

type PageStructureSidebarProps = {
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

export function PageStructureSidebar({
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
        const pendingReviewCount = pendingReviewCountOf(episodePage, reviewDecisions);
        return {
            index,
            pageNumber: episodePage.pageNumber,
            displayRef: episodePage.displayRef,
            panelCount: episodePage.panels.length,
            bubbleCount: bubbles.length,
            missingSourceText,
            pendingReviewCount,
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

            <details className="page-content-overview" open>
                <summary>{t("structure.sidebar.pageContentOverview")}</summary>
                <div className="page-content-list">
                    {pageContentStats.map((stat) => (
                        <button
                            key={`${stat.pageNumber}-${stat.index}`}
                            type="button"
                            className={`page-content-row ${pageIndex === stat.index ? "is-active" : ""}`}
                            onClick={() => onPageChange(stat.index)}
                        >
                            <span>
                                {stat.displayRef ? `${stat.displayRef} · ` : ""}
                                {t("structure.sidebar.pageContentRow", { pageNumber: stat.pageNumber })}
                            </span>
                            <small>
                                {t("structure.sidebar.pagePanelCount", { count: stat.panelCount })} · {t("structure.sidebar.pageBubbleCount", { count: stat.bubbleCount })} · {" "}
                                {hasLocaleImage(episode.pages[stat.index], "ja") ? t("structure.sidebar.imageJaShort") : t("structure.sidebar.imageJaMissingShort")}
                                {" / "}
                                {hasLocaleImage(episode.pages[stat.index], "en") ? t("structure.sidebar.imageEnShort") : t("structure.sidebar.imageEnMissingShort")}
                                {" · "}
                                {stat.missingSourceText
                                    ? t("structure.sidebar.pageMissingSourceText", { count: stat.missingSourceText })
                                    : t("structure.sidebar.pageSourceTextOk")}
                                {" · "}
                                {stat.pendingReviewCount
                                    ? t("structure.sidebar.pagePendingReview", { count: stat.pendingReviewCount })
                                    : t("structure.sidebar.pageReviewOk")}
                            </small>
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
