import type { BoundingBox, BubbleData, PageData, PanelData } from "../../api";
import type { ReviewDecision } from "../../lib/structure-review/types";

const DEFAULT_FLAGS: NonNullable<BubbleData["flags"]> = { shareable: true, feedback_enabled: true };

type StructureInspectorProps = {
    page: PageData | null;
    selectedPanel: PanelData | null;
    selectedPanelIndex: number | null;
    selectedBubble: BubbleData | null;
    selectedPanelDecision: ReviewDecision | null;
    selectedBubbleDecision: ReviewDecision | null;
    onUpdatePanel: (panelIndex: number, nextPanel: PanelData) => void;
    onUpdateSelectedPanelBox: (field: keyof BoundingBox, value: number) => void;
    onUpdateSelectedBubble: (patch: Partial<BubbleData>) => void;
    onUpdateSelectedBubbleBox: (field: keyof BoundingBox, value: number) => void;
    onAcceptPanel: (panel: PanelData) => void;
    onRejectSelectedPanel: () => void;
    onAcceptBubble: (bubble: BubbleData) => void;
    onRejectSelectedBubble: () => void;
};

export function StructureInspector({
    page,
    selectedPanel,
    selectedPanelIndex,
    selectedBubble,
    selectedPanelDecision,
    selectedBubbleDecision,
    onUpdatePanel,
    onUpdateSelectedPanelBox,
    onUpdateSelectedBubble,
    onUpdateSelectedBubbleBox,
    onAcceptPanel,
    onRejectSelectedPanel,
    onAcceptBubble,
    onRejectSelectedBubble,
}: StructureInspectorProps) {
    return (
        <aside className="structure-inspector card">
            <h2>Inspector</h2>
            {page && selectedPanel && selectedPanelIndex !== null ? (
                <>
                    <div className="section-actions" style={{ marginTop: 0 }}>
                        <span className="badge">Panel {selectedPanel.panelNumber}</span>
                        <span className={`badge ${selectedPanelDecision === "accepted" ? "badge-ok" : "badge-warn"}`}>
                            {selectedPanelDecision}
                        </span>
                        <button type="button" className="btn btn-outline" onClick={() => onAcceptPanel(selectedPanel)}>Accept</button>
                        <button type="button" className="btn btn-outline danger-lite-inline" onClick={onRejectSelectedPanel}>Reject</button>
                    </div>
                    <div className="form-group">
                        <label>Reaction Tags</label>
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
                                <label>Panel {field}</label>
                                <input
                                    type="number"
                                    value={Math.round(selectedPanel.bbox[field])}
                                    onChange={(e) => onUpdateSelectedPanelBox(field, Number(e.target.value))}
                                />
                            </div>
                        ))}
                    </div>

                    {selectedBubble ? (
                        <>
                            <div className="section-actions">
                                <span className="badge badge-ok">Bubble {selectedBubble.bubbleNumber}</span>
                                <span className={`badge ${selectedBubbleDecision === "accepted" ? "badge-ok" : "badge-warn"}`}>
                                    {selectedBubbleDecision}
                                </span>
                                <button type="button" className="btn btn-outline" onClick={() => onAcceptBubble(selectedBubble)}>Accept</button>
                                <button type="button" className="btn btn-outline danger-lite-inline" onClick={onRejectSelectedBubble}>Reject</button>
                            </div>
                            <div className="bubble-id-grid">
                                <div>
                                    <label>Bubble ID</label>
                                    <code>{selectedBubble.id}</code>
                                </div>
                                <div>
                                    <label>Short ID</label>
                                    <code>{selectedBubble.shortId}</code>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Original Text</label>
                                <textarea
                                    value={selectedBubble.textOriginal}
                                    onChange={(e) => onUpdateSelectedBubble({ textOriginal: e.target.value })}
                                    placeholder="セリフ原文"
                                />
                            </div>
                            <div className="form-group">
                                <label>Speaker</label>
                                <input
                                    value={selectedBubble.speaker ?? ""}
                                    onChange={(e) => onUpdateSelectedBubble({ speaker: e.target.value || undefined })}
                                    placeholder="character-id"
                                />
                            </div>
                            <div className="bbox-grid">
                                <div className="form-group">
                                    <label>Speaker Confidence</label>
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
                                    <label>Text Direction</label>
                                    <select
                                        value={selectedBubble.textDirection ?? "vertical"}
                                        onChange={(e) => onUpdateSelectedBubble({ textDirection: e.target.value as BubbleData["textDirection"] })}
                                    >
                                        <option value="vertical">vertical</option>
                                        <option value="horizontal">horizontal</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Bubble Type</label>
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
                                <label>Language</label>
                                <input
                                    value={selectedBubble.lang ?? ""}
                                    onChange={(e) => onUpdateSelectedBubble({ lang: e.target.value || undefined })}
                                    placeholder="ja"
                                />
                            </div>
                            <div className="flag-row">
                                {([
                                    ["shareable", "Shareable"],
                                    ["feedback_enabled", "Feedback"],
                                    ["contains_spoiler", "Spoiler"],
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
                                        <label>Bubble {field}</label>
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
                        <p className="card-meta">Select or add a bubble to edit text and bubble bbox.</p>
                    )}
                </>
            ) : (
                <p className="card-meta">Add or select a panel to start structure review.</p>
            )}
        </aside>
    );
}
