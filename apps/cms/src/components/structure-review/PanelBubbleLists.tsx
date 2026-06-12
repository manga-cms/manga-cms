import type { BubbleData, PageData, PanelData } from "../../api";
import { useTranslation } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n/messages";
import { formatBboxSummary, getBubbleCandidates, getBubbleSourceText, getBubbleTextComparisonBadges, getBubbleWarnings, getReviewDisplayState } from "../../lib/structure-review/bubbleDraft";
import { bubbleIdOf, panelIdOf } from "../../lib/structure-review/ids";
import { bubbleReviewKey, panelReviewKey } from "../../lib/structure-review/reviewDecisions";
import type { ReviewDecisions } from "../../lib/structure-review/types";

type PanelBubbleListsProps = {
    page: PageData | null;
    panels: PanelData[];
    selectedPanel: PanelData | null;
    selectedPanelIndex: number | null;
    selectedBubbleIndex: number | null;
    reviewDecisions: ReviewDecisions;
    onSelectPanel: (index: number) => void;
    onSelectBubble: (index: number) => void;
    onSelectBubbleCandidate: (panelIndex: number | null, bubbleIndex: number) => void;
    onMovePanel: (index: number, direction: -1 | 1) => void;
    onMoveBubble: (index: number, direction: -1 | 1) => void;
    onMoveBubbleCandidate: (panelIndex: number | null, bubbleIndex: number, direction: -1 | 1) => void;
};

const decisionLabelKey = (decision: string | undefined): MessageKey => `decision.${decision ?? "pending"}` as MessageKey;
const reviewStateLabelKey = (state: string): MessageKey => `structure.reviewState.${state}` as MessageKey;

function bubbleDisplayRef(bubble: PageData["bubbles"][number]) {
    return bubble.displayRef ?? bubble.shortId ?? bubbleIdOf(bubble);
}

function CandidateTextBadges({ bubble }: { bubble: BubbleData }) {
    const { t } = useTranslation();
    const comparison = getBubbleTextComparisonBadges(bubble);
    if (!comparison.hasSourceText && !comparison.hasOcrText && comparison.confidence === undefined) return null;

    return (
        <div className="structure-candidate-badges">
            {comparison.hasSourceText && (
                <span className={`badge ${comparison.sourceDiffers ? "badge-warn" : "badge-muted"}`}>
                    {comparison.sourceDiffers ? t("structure.textCompare.sourceDiffers") : t("structure.textCompare.psdSource")}
                </span>
            )}
            {comparison.hasOcrText && (
                <span className={`badge ${comparison.ocrDiffers ? "badge-warn" : "badge-muted"}`}>
                    {comparison.ocrDiffers ? t("structure.textCompare.ocrDiffers") : t("structure.textCompare.ocrText")}
                </span>
            )}
            {comparison.confidence !== undefined && (
                <span className={`badge ${comparison.confidence < 0.75 ? "badge-warn" : "badge-ok"}`}>
                    {t("structure.textCompare.confidenceShort", { value: comparison.confidence.toFixed(2) })}
                </span>
            )}
        </div>
    );
}

export function PanelBubbleLists({
    page,
    panels,
    selectedPanel,
    selectedPanelIndex,
    selectedBubbleIndex,
    reviewDecisions,
    onSelectPanel,
    onSelectBubble,
    onSelectBubbleCandidate,
    onMovePanel,
    onMoveBubble,
    onMoveBubbleCandidate,
}: PanelBubbleListsProps) {
    const { t } = useTranslation();
    const bubbleCandidates = getBubbleCandidates(page, reviewDecisions);
    const pageLevelCandidateCount = bubbleCandidates.filter((candidate) => candidate.panelIndex === null).length;

    return (
        <>
            <h2>{t("structure.sidebar.bubbleCandidates")}</h2>
            <div className="structure-list">
                {bubbleCandidates.length === 0 && (
                    <p className="card-meta">{t("structure.sidebar.noBubbles")}</p>
                )}
                {bubbleCandidates.map((candidate) => (
                    <div
                        key={bubbleIdOf(candidate.bubble)}
                        className={`structure-list-row ${selectedPanelIndex === candidate.panelIndex && selectedBubbleIndex === candidate.bubbleIndex ? "is-active" : ""}`}
                    >
                        <button
                            type="button"
                            className="structure-list-item structure-list-item-text"
                            onClick={() => onSelectBubbleCandidate(candidate.panelIndex, candidate.bubbleIndex)}
                        >
                            <div className="structure-list-title">
                                <strong>{t("structure.sidebar.bubbleCandidateRow", { readingOrder: candidate.readingOrder })}</strong>
                                <code>{bubbleDisplayRef(candidate.bubble)}</code>
                            </div>
                            <div className="structure-review-state-row">
                                <span className={`badge review-state-${getReviewDisplayState(candidate.decision, candidate.warnings)}`}>
                                    {t(reviewStateLabelKey(getReviewDisplayState(candidate.decision, candidate.warnings)))}
                                </span>
                                <span className="badge badge-muted">{t(decisionLabelKey(candidate.decision))}</span>
                            </div>
                            <CandidateTextBadges bubble={candidate.bubble} />
                            <div className="structure-source-line">
                                <span>{t("structure.sidebar.sourceTextLabel")}</span>
                                <p>{getBubbleSourceText(candidate.bubble) || t("structure.sidebar.noText")}</p>
                            </div>
                            <small className="structure-list-meta">
                                {candidate.panel
                                    ? t("structure.sidebar.panelRow", { panelNumber: candidate.panel.panelNumber })
                                    : t("structure.sidebar.pageLevelBubble")}
                                {" · "}
                                {candidate.bubble.bubbleType} · {t(decisionLabelKey(candidate.decision))}
                                {" · "}
                                <span className="bbox-summary">{formatBboxSummary(candidate.bubble.bbox)}</span>
                                {candidate.warnings.length > 0 ? ` · ${t("structure.sidebar.warningCount", { count: candidate.warnings.length })}` : ""}
                            </small>
                            {candidate.warnings.length > 0 && (
                                <div className="structure-warning-chips">
                                    {candidate.warnings.map((warning) => (
                                        <span key={warning} className="badge badge-warn">{t(`structure.warning.${warning}` as MessageKey)}</span>
                                    ))}
                                </div>
                            )}
                        </button>
                        <div className="order-controls">
                            <button type="button" onClick={() => onMoveBubbleCandidate(candidate.panelIndex, candidate.bubbleIndex, -1)} disabled={candidate.bubbleIndex === 0} aria-label={t("structure.sidebar.moveBubbleEarlier")}>↑</button>
                            <button type="button" onClick={() => onMoveBubbleCandidate(candidate.panelIndex, candidate.bubbleIndex, 1)} disabled={candidate.panel ? candidate.bubbleIndex === candidate.panel.bubbles.length - 1 : candidate.bubbleIndex === pageLevelCandidateCount - 1} aria-label={t("structure.sidebar.moveBubbleLater")}>↓</button>
                        </div>
                    </div>
                ))}
            </div>

            <details className="optional-panel-list">
                <summary>{t("structure.sidebar.optionalPanels")}</summary>
                <div className="structure-list">
                    {panels.map((panel, index) => (
                        <div
                            key={panelIdOf(panel)}
                            className={`structure-list-row ${selectedPanelIndex === index ? "is-active" : ""}`}
                        >
                            <button
                                type="button"
                                className="structure-list-item"
                                onClick={() => onSelectPanel(index)}
                            >
                                <span>{t("structure.sidebar.panelRow", { panelNumber: panel.panelNumber })}</span>
                                <small>
                                    {t("structure.sidebar.bubbleCount", { count: panel.bubbles.length })} · {t(decisionLabelKey(reviewDecisions[panelReviewKey(panel)]))}
                                    {" · "}
                                    <span className="bbox-summary">{formatBboxSummary(panel.bbox)}</span>
                                </small>
                            </button>
                            <div className="order-controls">
                                <button type="button" onClick={() => onMovePanel(index, -1)} disabled={index === 0} aria-label={t("structure.sidebar.movePanelEarlier")}>↑</button>
                                <button type="button" onClick={() => onMovePanel(index, 1)} disabled={index === panels.length - 1} aria-label={t("structure.sidebar.movePanelLater")}>↓</button>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedPanel && (
                    <>
                        <h2>{t("structure.sidebar.selectedPanelBubbles")}</h2>
                        <div className="structure-list">
                            {selectedPanel.bubbles.map((bubble, index) => {
                                const warnings = getBubbleWarnings(page, bubble);
                                return (
                                    <div
                                        key={bubbleIdOf(bubble)}
                                        className={`structure-list-row ${selectedBubbleIndex === index ? "is-active" : ""}`}
                                    >
                                        <button
                                            type="button"
                                            className="structure-list-item structure-list-item-text"
                                            onClick={() => onSelectBubble(index)}
                                        >
                                            <div className="structure-list-title">
                                                <strong>{t("structure.sidebar.bubbleRow", { bubbleNumber: bubble.bubbleNumber })}</strong>
                                                <code>{bubbleDisplayRef(bubble)}</code>
                                            </div>
                                            <div className="structure-review-state-row">
                                                <span className={`badge review-state-${getReviewDisplayState(reviewDecisions[bubbleReviewKey(bubble)], warnings)}`}>
                                                    {t(reviewStateLabelKey(getReviewDisplayState(reviewDecisions[bubbleReviewKey(bubble)], warnings)))}
                                                </span>
                                                <span className="badge badge-muted">{t(decisionLabelKey(reviewDecisions[bubbleReviewKey(bubble)]))}</span>
                                            </div>
                                            <CandidateTextBadges bubble={bubble} />
                                            <div className="structure-source-line">
                                                <span>{t("structure.sidebar.sourceTextLabel")}</span>
                                                <p>{getBubbleSourceText(bubble) || t("structure.sidebar.noText")}</p>
                                            </div>
                                            <small className="structure-list-meta">
                                                {t(decisionLabelKey(reviewDecisions[bubbleReviewKey(bubble)]))}
                                                {" · "}
                                                <span className="bbox-summary">{formatBboxSummary(bubble.bbox)}</span>
                                                {warnings.length > 0 ? ` · ${t("structure.sidebar.warningCount", { count: warnings.length })}` : ""}
                                            </small>
                                            {warnings.length > 0 && (
                                                <div className="structure-warning-chips">
                                                    {warnings.map((warning) => (
                                                        <span key={warning} className="badge badge-warn">{t(`structure.warning.${warning}` as MessageKey)}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </button>
                                        <div className="order-controls">
                                            <button type="button" onClick={() => onMoveBubble(index, -1)} disabled={index === 0} aria-label={t("structure.sidebar.moveBubbleEarlier")}>↑</button>
                                            <button type="button" onClick={() => onMoveBubble(index, 1)} disabled={index === selectedPanel.bubbles.length - 1} aria-label={t("structure.sidebar.moveBubbleLater")}>↓</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </details>
        </>
    );
}
