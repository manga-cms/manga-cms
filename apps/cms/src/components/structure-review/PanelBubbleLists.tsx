import type { BubbleData, PageData, PanelData } from "../../api";
import { useTranslation } from "../../i18n/I18nProvider";
import type { MessageKey } from "../../i18n/messages";
import {
    formatBboxSummary,
    getBubbleCandidates,
    getBubbleSourceText,
    getBubbleTextComparisonBadges,
    type BubbleTextComparisonOverlayMap,
} from "../../lib/structure-review/bubbleDraft";
import { bubbleIdOf, panelIdOf } from "../../lib/structure-review/ids";
import { panelReviewKey } from "../../lib/structure-review/reviewDecisions";
import type { ReviewDecisions } from "../../lib/structure-review/types";

type PanelBubbleListsProps = {
    page: PageData | null;
    panels: PanelData[];
    selectedPanelIndex: number | null;
    selectedBubbleIndex: number | null;
    reviewDecisions: ReviewDecisions;
    textComparisonOverlays?: BubbleTextComparisonOverlayMap;
    onSelectPanel: (index: number) => void;
    onSelectBubbleCandidate: (panelIndex: number | null, bubbleIndex: number) => void;
    onMovePanel: (index: number, direction: -1 | 1) => void;
    onMoveBubbleCandidate: (bubbleId: string, direction: -1 | 1) => void;
};

const decisionLabelKey = (decision: string | undefined): MessageKey => `decision.${decision ?? "pending"}` as MessageKey;

function bubbleDisplayRef(bubble: PageData["bubbles"][number]) {
    return bubble.displayRef ?? bubble.shortId ?? bubbleIdOf(bubble);
}

function CandidateTextBadges({ bubble, textComparisonOverlays }: { bubble: BubbleData; textComparisonOverlays?: BubbleTextComparisonOverlayMap }) {
    const { t } = useTranslation();
    const comparison = getBubbleTextComparisonBadges(bubble, textComparisonOverlays?.get(bubbleIdOf(bubble)));
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
    selectedPanelIndex,
    selectedBubbleIndex,
    reviewDecisions,
    textComparisonOverlays,
    onSelectPanel,
    onSelectBubbleCandidate,
    onMovePanel,
    onMoveBubbleCandidate,
}: PanelBubbleListsProps) {
    const { t } = useTranslation();
    const bubbleCandidates = getBubbleCandidates(page, reviewDecisions, textComparisonOverlays);

    return (
        <>
            <details className="structure-sidebar-group" open>
                <summary>{t("structure.sidebar.groupCandidates")}</summary>
                <div className="structure-list">
                    {bubbleCandidates.length === 0 && (
                        <p className="card-meta">{t("structure.sidebar.noBubbles")}</p>
                    )}
                    {bubbleCandidates.map((candidate, candidateIndex) => (
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
                                    <span className={`badge ${candidate.decision === "accepted" ? "badge-ok" : candidate.decision === "rejected" ? "badge-muted" : "badge-warn"}`}>
                                        {t(decisionLabelKey(candidate.decision))}
                                    </span>
                                    {candidate.warnings.length > 0 && (
                                        <span className="badge badge-err">{t("structure.reviewState.needs_review")}</span>
                                    )}
                                </div>
                                <CandidateTextBadges bubble={candidate.bubble} textComparisonOverlays={textComparisonOverlays} />
                                <div className="structure-source-line">
                                    <span>{t("structure.sidebar.sourceTextLabel")}</span>
                                    <p>{getBubbleSourceText(candidate.bubble) || t("structure.sidebar.noText")}</p>
                                </div>
                                <small className="structure-list-meta">
                                    {candidate.panel
                                        ? t("structure.sidebar.panelRow", { panelNumber: candidate.panel.panelNumber })
                                        : t("structure.sidebar.pageLevelBubble")}
                                    {" · "}
                                    {candidate.bubble.bubbleType}
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
                                <button type="button" onClick={() => onMoveBubbleCandidate(bubbleIdOf(candidate.bubble), -1)} disabled={candidateIndex === 0} aria-label={t("structure.sidebar.moveBubbleEarlier")}>↑</button>
                                <button type="button" onClick={() => onMoveBubbleCandidate(bubbleIdOf(candidate.bubble), 1)} disabled={candidateIndex === bubbleCandidates.length - 1} aria-label={t("structure.sidebar.moveBubbleLater")}>↓</button>
                            </div>
                        </div>
                    ))}
                </div>
            </details>

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
            </details>
        </>
    );
}
