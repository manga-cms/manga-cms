import type { BoundingBox, BubbleData, BubbleTextLayout, BubbleTextStyle, PageData, PanelData } from "../../api";
import { useTranslation } from "../../i18n/I18nProvider";
import { getBubbleSourceText, getBubbleTextComparison, getBubbleWarnings, type BubbleTextComparisonOverlay } from "../../lib/structure-review/bubbleDraft";
import { bubbleIdOf } from "../../lib/structure-review/ids";
import type { ReviewDecision } from "../../lib/structure-review/types";
import type { MessageKey } from "../../i18n/messages";
import { TranslationWorkspace } from "./TranslationWorkspace";

const DEFAULT_FLAGS: NonNullable<BubbleData["flags"]> = { shareable: true, feedback_enabled: true };
const decisionLabelKey = (decision: ReviewDecision | null): MessageKey => `decision.${decision ?? "pending"}` as MessageKey;

type StructureInspectorProps = {
    seriesId?: string;
    episodeId?: string;
    page: PageData | null;
    selectedPanel: PanelData | null;
    selectedPanelIndex: number | null;
    selectedBubble: BubbleData | null;
    selectedBubbleTextComparison?: BubbleTextComparisonOverlay;
    selectedPanelDecision: ReviewDecision | null;
    selectedBubbleDecision: ReviewDecision | null;
    letteringMode: boolean;
    canManageLettering: boolean;
    letteringSaving: boolean;
    letteringSaved: boolean;
    letteringDirty: boolean;
    onToggleLetteringMode: () => void;
    onUpdatePanel: (panelIndex: number, nextPanel: PanelData) => void;
    onUpdateSelectedPanelBox: (field: keyof BoundingBox, value: number) => void;
    onUpdateSelectedBubble: (patch: Partial<BubbleData>) => void;
    onPreviewSelectedBubbleLettering: (patch: { textLayout?: BubbleTextLayout; textStyle?: BubbleTextStyle }) => void;
    onSaveSelectedBubbleLettering: () => void;
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
    selectedBubbleTextComparison,
    selectedPanelDecision,
    selectedBubbleDecision,
    letteringMode,
    canManageLettering,
    letteringSaving,
    letteringSaved,
    letteringDirty,
    onToggleLetteringMode,
    onUpdatePanel,
    onUpdateSelectedPanelBox,
    onUpdateSelectedBubble,
    onPreviewSelectedBubbleLettering,
    onSaveSelectedBubbleLettering,
    onUpdateSelectedBubbleReadingOrder,
    onUpdateSelectedBubbleBox,
    onAssignSelectedBubblePanel,
    onAcceptPanel,
    onRejectSelectedPanel,
    onAcceptBubble,
    onRejectSelectedBubble,
}: StructureInspectorProps) {
    const { t } = useTranslation();
    const bubbleWarnings = selectedBubble ? getBubbleWarnings(page, selectedBubble, selectedBubbleTextComparison) : [];
    const bubbleTextComparison = selectedBubble ? getBubbleTextComparison(selectedBubble, selectedBubbleTextComparison) : null;

    const updateTextLayout = (patch: BubbleTextLayout) => {
        if (!selectedBubble) return;
        const next = { ...(selectedBubble.textLayout ?? {}), ...patch, source: "manual" as const };
        onPreviewSelectedBubbleLettering({ textLayout: next });
    };

    const updateTextStyle = (patch: BubbleTextStyle) => {
        if (!selectedBubble) return;
        const next = { ...(selectedBubble.textStyle ?? {}), ...patch };
        onPreviewSelectedBubbleLettering({ textStyle: next });
    };

    const numberOrUndefined = (value: string) => {
        if (value.trim() === "") return undefined;
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : undefined;
    };

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
                                {bubbleWarnings.length > 0 && (
                                    <span className="badge badge-err">{t("structure.reviewState.needs_review")}</span>
                                )}
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
                                <div className="lettering-editor-panel">
                                    <div className="canonical-bubble-header">
                                        <h3>{t("structure.lettering.title")}</h3>
                                        <p>{t("structure.lettering.description")}</p>
                                    </div>
                                    <button type="button" className="btn btn-outline" onClick={onToggleLetteringMode}>
                                        {letteringMode ? t("structure.lettering.previewOn") : t("structure.lettering.previewOff")}
                                    </button>
                                    <div className="form-group">
                                        <label>{t("structure.lettering.lines")}</label>
                                        <textarea
                                            value={selectedBubble.textLayout?.lines?.join("\n") ?? selectedBubble.textOriginal}
                                            onChange={(e) => {
                                                const lines = e.target.value.split(/\r?\n/u);
                                                updateTextLayout({ lines });
                                            }}
                                        />
                                        <small>{t("structure.lettering.linesHelp")}</small>
                                    </div>
                                    <div className="bubble-field-grid">
                                        <div className="form-group">
                                            <label>{t("structure.lettering.inlineAlign")}</label>
                                            <select
                                                value={selectedBubble.textLayout?.inlineAlign ?? "start"}
                                                onChange={(e) => updateTextLayout({ inlineAlign: e.target.value as BubbleTextLayout["inlineAlign"] })}
                                            >
                                                <option value="start">{t("structure.lettering.alignStart")}</option>
                                                <option value="center">{t("structure.lettering.alignCenter")}</option>
                                                <option value="end">{t("structure.lettering.alignEnd")}</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>{t("structure.lettering.blockAlign")}</label>
                                            <select
                                                value={selectedBubble.textLayout?.blockAlign ?? "start"}
                                                onChange={(e) => updateTextLayout({ blockAlign: e.target.value as BubbleTextLayout["blockAlign"] })}
                                            >
                                                <option value="start">{t("structure.lettering.alignStart")}</option>
                                                <option value="center">{t("structure.lettering.alignCenter")}</option>
                                                <option value="end">{t("structure.lettering.alignEnd")}</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="bbox-grid">
                                        <div className="form-group">
                                            <label>{t("structure.lettering.fontSizePx")}</label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={selectedBubble.textStyle?.fontSizePx ?? ""}
                                                onChange={(e) => updateTextStyle({ fontSizePx: numberOrUndefined(e.target.value) })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t("structure.lettering.fontWeight")}</label>
                                            <select
                                                value={selectedBubble.textStyle?.fontWeight ?? ""}
                                                onChange={(e) => updateTextStyle({ fontWeight: numberOrUndefined(e.target.value) })}
                                            >
                                                <option value="">{t("structure.lettering.auto")}</option>
                                                {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => (
                                                    <option key={weight} value={weight}>{weight}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>{t("structure.lettering.lineHeight")}</label>
                                            <input
                                                type="number"
                                                step="0.05"
                                                min={0.1}
                                                value={selectedBubble.textStyle?.lineHeight ?? ""}
                                                onChange={(e) => updateTextStyle({ lineHeight: numberOrUndefined(e.target.value) })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>{t("structure.lettering.letterSpacing")}</label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={selectedBubble.textStyle?.letterSpacing ?? ""}
                                                onChange={(e) => updateTextStyle({ letterSpacing: numberOrUndefined(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>{t("structure.lettering.fitMode")}</label>
                                        <select
                                            value={selectedBubble.textStyle?.fitMode ?? "auto"}
                                            onChange={(e) => updateTextStyle({ fitMode: e.target.value as BubbleTextStyle["fitMode"] })}
                                        >
                                            <option value="auto">auto</option>
                                            <option value="shrink">shrink</option>
                                            <option value="fixed">fixed</option>
                                        </select>
                                    </div>
                                    {canManageLettering ? (
                                        <div className="section-actions">
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={onSaveSelectedBubbleLettering}
                                                disabled={letteringSaving || !letteringDirty}
                                            >
                                                {letteringSaving ? t("structure.lettering.saving") : t("structure.lettering.save")}
                                            </button>
                                            {letteringSaved && <span className="success-msg-inline">{t("structure.lettering.saved")}</span>}
                                        </div>
                                    ) : (
                                        <p className="card-meta">{t("structure.lettering.manageRightsRequired")}</p>
                                    )}
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
