import type { BoundingBox, BubbleData, PageData, PanelData } from "../../api";
import { useTranslation } from "../../i18n/I18nProvider";
import { getBubbleSourceText, getBubbleTextComparison, getBubbleWarnings, getReviewDisplayState } from "../../lib/structure-review/bubbleDraft";
import { bubbleIdOf } from "../../lib/structure-review/ids";
import type { ReviewDecision } from "../../lib/structure-review/types";
import type { MessageKey } from "../../i18n/messages";
import { TranslationWorkspace } from "./TranslationWorkspace";

const DEFAULT_FLAGS: NonNullable<BubbleData["flags"]> = { shareable: true, feedback_enabled: true };
const decisionLabelKey = (decision: ReviewDecision | null): MessageKey => `decision.${decision ?? "pending"}` as MessageKey;
const reviewStateLabelKey = (state: string): MessageKey => `structure.reviewState.${state}` as MessageKey;

type StructureInspectorProps = {
    seriesId?: string;
    episodeId?: string;
    page: PageData | null;
    selectedPanel: PanelData | null;
    selectedPanelIndex: number | null;
    selectedBubble: BubbleData | null;
    selectedPanelDecision: ReviewDecision | null;
    selectedBubbleDecision: ReviewDecision | null;
    onUpdatePanel: (panelIndex: number, nextPanel: PanelData) => void;
    onUpdateSelectedPanelBox: (field: keyof BoundingBox, value: number) => void;
    onUpdateSelectedBubble: (patch: Partial<BubbleData>) => void;
    onUpdateSelectedBubbleReadingOrder: (readingOrder: number) => void;
    onUpdateSelectedBubbleBox: (field: keyof BoundingBox, value: number) => void;
    onAssignSelectedBubblePanel: (panelIndex: number | null) => void;
    onAcceptPanel: (panel: PanelData) => void;
    onRejectSelectedPanel: () => void;
    onAcceptBubble: (bubble: BubbleData) => void;
    onRejectSelectedBubble: () => void;
};

export function StructureInspector({
    seriesId,
    episodeId,
    page,
    selectedPanel,
    selectedPanelIndex,
    selectedBubble,
    selectedPanelDecision,
    selectedBubbleDecision,
    onUpdatePanel,
    onUpdateSelectedPanelBox,
    onUpdateSelectedBubble,
    onUpdateSelectedBubbleReadingOrder,
    onUpdateSelectedBubbleBox,
    onAssignSelectedBubblePanel,
    onAcceptPanel,
    onRejectSelectedPanel,
    onAcceptBubble,
    onRejectSelectedBubble,
}: StructureInspectorProps) {
    const { t } = useTranslation();
    const bubbleWarnings = selectedBubble ? getBubbleWarnings(page, selectedBubble) : [];
    const bubbleTextComparison = selectedBubble ? getBubbleTextComparison(selectedBubble) : null;

    return (
        <aside className="structure-inspector card">
            <h2>{t("structure.inspector.title")}</h2>
            {selectedBubble && bubbleWarnings.length > 0 && (
                <div className="warning-list warning-list-priority">
                    <strong>{t("structure.inspector.warnings")}</strong>
                    {bubbleWarnings.map((warning) => (
                        <span key={warning} className="badge badge-warn">{t(`structure.warning.${warning}` as MessageKey)}</span>
                    ))}
                </div>
            )}
            {page && selectedPanel && selectedPanelIndex !== null && (
                <>
                    <div className="section-actions" style={{ marginTop: 0 }}>
                        <span className="badge">{t("structure.inspector.panelBadge", { panelNumber: selectedPanel.panelNumber })}</span>
                        <span className={`badge ${selectedPanelDecision === "accepted" ? "badge-ok" : "badge-warn"}`}>
                            {t(decisionLabelKey(selectedPanelDecision))}
                        </span>
                        <button type="button" className="btn btn-outline" onClick={() => onAcceptPanel(selectedPanel)}>{t("structure.inspector.accept")}</button>
                        <button type="button" className="btn btn-outline danger-lite-inline" onClick={onRejectSelectedPanel}>{t("structure.inspector.reject")}</button>
                    </div>
                    <div className="form-group">
                        <label>{t("structure.inspector.reactionTags")}</label>
                        <input
                            value={selectedPanel.reactionTags.join(", ")}
                            onChange={(e) => onUpdatePanel(selectedPanelIndex, {
                                ...selectedPanel,
                                reactionTags: e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean),
                            })}
                            placeholder="surprise, closeup"
                        />
                    </div>
                    <div className="bbox-grid">
                        {(["x", "y", "width", "height"] as const).map((field) => (
                            <div className="form-group" key={field}>
                                <label>{t("structure.inspector.panelField", { field })}</label>
                                <input
                                    type="number"
                                    value={Math.round(selectedPanel.bbox[field])}
                                    onChange={(e) => onUpdateSelectedPanelBox(field, Number(e.target.value))}
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}

            {selectedBubble ? (
                <>
                            <div className="section-actions">
                                <span className="badge badge-ok">{t("structure.inspector.bubbleBadge", { bubbleNumber: selectedBubble.bubbleNumber })}</span>
                                <span className={`badge ${selectedBubbleDecision === "accepted" ? "badge-ok" : "badge-warn"}`}>
                                    {t(decisionLabelKey(selectedBubbleDecision))}
                                </span>
                                <span className={`badge review-state-${getReviewDisplayState(selectedBubbleDecision ?? undefined, bubbleWarnings)}`}>
                                    {t(reviewStateLabelKey(getReviewDisplayState(selectedBubbleDecision ?? undefined, bubbleWarnings)))}
                                </span>
                                <button type="button" className="btn btn-outline" onClick={() => onAcceptBubble(selectedBubble)}>{t("structure.inspector.accept")}</button>
                                <button type="button" className="btn btn-outline danger-lite-inline" onClick={onRejectSelectedBubble}>{t("structure.inspector.reject")}</button>
                            </div>
                            <div className="bubble-id-grid">
                                <div>
                                    <label>{t("structure.inspector.bubbleId")}</label>
                                    <code>{bubbleIdOf(selectedBubble)}</code>
                                </div>
                                <div>
                                    <label>{t("structure.inspector.displayRef")}</label>
                                    <code>{selectedBubble.displayRef ?? selectedBubble.shortId}</code>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>{t("structure.inspector.readingOrder")}</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={selectedBubble.bubbleNumber}
                                    onChange={(e) => onUpdateSelectedBubbleReadingOrder(Number(e.target.value))}
                                />
                            </div>
                            {page && (
                                <div className="form-group">
                                    <label>{t("structure.inspector.panelAssignment")}</label>
                                    <select
                                        value={selectedPanelIndex ?? ""}
                                        onChange={(e) => onAssignSelectedBubblePanel(e.target.value === "" ? null : Number(e.target.value))}
                                    >
                                        <option value="">{t("structure.sidebar.pageLevelBubble")}</option>
                                        {page.panels.map((panel, index) => (
                                            <option key={panel.panelId ?? panel.id} value={index}>
                                                {t("structure.sidebar.panelRow", { panelNumber: panel.panelNumber })}
                                            </option>
                                        ))}
                                    </select>
                                    <small>{t("structure.inspector.panelAssignmentHelp")}</small>
                                </div>
                            )}
                            <div className="canonical-bubble-editor">
                                <div className="canonical-bubble-header">
                                    <h3>{t("structure.inspector.canonicalTitle")}</h3>
                                    <p>{t("structure.inspector.canonicalDescription")}</p>
                                </div>
                                <div className="form-group">
                                    <label>{t("structure.inspector.sourceText")}</label>
                                    <textarea
                                        value={getBubbleSourceText(selectedBubble)}
                                        onChange={(e) => onUpdateSelectedBubble({ textOriginal: e.target.value })}
                                        placeholder={t("structure.inspector.sourceTextPlaceholder")}
                                    />
                                </div>
                                {bubbleTextComparison && (
                                    <div className="structure-text-compare">
                                        <h4>{t("structure.textCompare.title")}</h4>
                                        <div>
                                            <span>{t("structure.textCompare.psdSource")}</span>
                                            <p>{bubbleTextComparison.sourceText ?? t("structure.textCompare.unavailable")}</p>
                                        </div>
                                        <div>
                                            <span>{t("structure.textCompare.ocrText")}</span>
                                            <p>{bubbleTextComparison.ocrText ?? t("structure.textCompare.unavailable")}</p>
                                        </div>
                                        <div>
                                            <span>{t("structure.textCompare.chosenText")}</span>
                                            <p>{bubbleTextComparison.chosenText || t("structure.textCompare.unavailable")}</p>
                                        </div>
                                        {bubbleTextComparison.confidence !== undefined && (
                                            <small>{t("structure.textCompare.confidence", { value: bubbleTextComparison.confidence.toFixed(2) })}</small>
                                        )}
                                    </div>
                                )}
                                <div className="bubble-field-grid">
                                    <div className="form-group">
                                        <label>{t("structure.inspector.speaker")}</label>
                                        <input
                                            value={selectedBubble.speaker ?? ""}
                                            onChange={(e) => {
                                                const speaker = e.target.value.trim();
                                                onUpdateSelectedBubble({ speaker: speaker || undefined });
                                            }}
                                            placeholder="character-id"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>{t("structure.inspector.bubbleType")}</label>
                                        <select
                                            value={selectedBubble.bubbleType}
                                            onChange={(e) => onUpdateSelectedBubble({ bubbleType: e.target.value as BubbleData["bubbleType"] })}
                                        >
                                            <option value="speech">speech</option>
                                            <option value="thought">thought</option>
                                            <option value="narration">narration</option>
                                            <option value="sfx">sfx</option>
                                            <option value="caption">caption</option>
                                            <option value="other">other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>{t("structure.inspector.textDirection")}</label>
                                        <select
                                            value={selectedBubble.textDirection ?? "vertical"}
                                            onChange={(e) => onUpdateSelectedBubble({ textDirection: e.target.value as BubbleData["textDirection"] })}
                                        >
                                            <option value="vertical">vertical</option>
                                            <option value="horizontal">horizontal</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>{t("structure.inspector.speakerConfidence")}</label>
                                        <select
                                            value={selectedBubble.speakerConfidence ?? "unknown"}
                                            onChange={(e) => onUpdateSelectedBubble({ speakerConfidence: e.target.value as BubbleData["speakerConfidence"] })}
                                        >
                                            <option value="unknown">unknown</option>
                                            <option value="inferred">inferred</option>
                                            <option value="confirmed">confirmed</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>{t("structure.inspector.language")}</label>
                                        <input
                                            value={selectedBubble.lang ?? ""}
                                            onChange={(e) => onUpdateSelectedBubble({ lang: e.target.value || undefined })}
                                            placeholder="ja"
                                        />
                                    </div>
                                </div>
                            </div>
                            {page && selectedPanel && (
                                <TranslationWorkspace
                                    seriesId={seriesId}
                                    episodeId={episodeId}
                                    page={page}
                                    selectedPanel={selectedPanel}
                                    selectedBubble={selectedBubble}
                                />
                            )}
                            <div className="flag-row">
                                {([
                                    ["shareable", t("structure.inspector.shareable")],
                                    ["feedback_enabled", t("structure.inspector.feedback")],
                                    ["contains_spoiler", t("structure.inspector.spoiler")],
                                ] as const).map(([field, label]) => {
                                    const flags = selectedBubble.flags ?? DEFAULT_FLAGS;
                                    return (
                                        <label key={field}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(flags[field])}
                                                onChange={(e) => onUpdateSelectedBubble({
                                                    flags: { ...DEFAULT_FLAGS, ...selectedBubble.flags, [field]: e.target.checked },
                                                })}
                                            />
                                            {label}
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="bbox-grid">
                                {(["x", "y", "width", "height"] as const).map((field) => (
                                    <div className="form-group" key={field}>
                                        <label>{t("structure.inspector.bubbleField", { field })}</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedBubble.bbox[field])}
                                            onChange={(e) => onUpdateSelectedBubbleBox(field, Number(e.target.value))}
                                        />
                                    </div>
                                ))}
                            </div>
                </>
            ) : (
                <p className="card-meta">{t(page && selectedPanel ? "structure.inspector.selectBubble" : "structure.inspector.selectPanel")}</p>
            )}
        </aside>
    );
}
