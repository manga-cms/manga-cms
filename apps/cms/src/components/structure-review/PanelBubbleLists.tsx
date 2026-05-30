import type { PanelData } from "../../api";
import { bubbleReviewKey, panelReviewKey } from "../../lib/structure-review/reviewDecisions";
import type { ReviewDecisions } from "../../lib/structure-review/types";

type PanelBubbleListsProps = {
    panels: PanelData[];
    selectedPanel: PanelData | null;
    selectedPanelIndex: number | null;
    selectedBubbleIndex: number | null;
    reviewDecisions: ReviewDecisions;
    onSelectPanel: (index: number) => void;
    onSelectBubble: (index: number) => void;
    onMovePanel: (index: number, direction: -1 | 1) => void;
    onMoveBubble: (index: number, direction: -1 | 1) => void;
};

export function PanelBubbleLists({
    panels,
    selectedPanel,
    selectedPanelIndex,
    selectedBubbleIndex,
    reviewDecisions,
    onSelectPanel,
    onSelectBubble,
    onMovePanel,
    onMoveBubble,
}: PanelBubbleListsProps) {
    return (
        <>
            <h2>Panels</h2>
            <div className="structure-list">
                {panels.map((panel, index) => (
                    <div
                        key={panel.id}
                        className={`structure-list-row ${selectedPanelIndex === index ? "is-active" : ""}`}
                    >
                        <button
                            type="button"
                            className="structure-list-item"
                            onClick={() => onSelectPanel(index)}
                        >
                            <span>Panel {panel.panelNumber}</span>
                            <small>{panel.bubbles.length} bubbles · {reviewDecisions[panelReviewKey(panel)] ?? "pending"}</small>
                        </button>
                        <div className="order-controls">
                            <button type="button" onClick={() => onMovePanel(index, -1)} disabled={index === 0} aria-label="Move panel earlier">↑</button>
                            <button type="button" onClick={() => onMovePanel(index, 1)} disabled={index === panels.length - 1} aria-label="Move panel later">↓</button>
                        </div>
                    </div>
                ))}
            </div>

            <h2>Bubbles</h2>
            <div className="structure-list">
                {selectedPanel?.bubbles.map((bubble, index) => (
                    <div
                        key={bubble.id}
                        className={`structure-list-row ${selectedBubbleIndex === index ? "is-active" : ""}`}
                    >
                        <button
                            type="button"
                            className="structure-list-item"
                            onClick={() => onSelectBubble(index)}
                        >
                            <span>Bubble {bubble.bubbleNumber}</span>
                            <small>{bubble.textOriginal || "No text"} · {reviewDecisions[bubbleReviewKey(bubble)] ?? "pending"}</small>
                        </button>
                        <div className="order-controls">
                            <button type="button" onClick={() => onMoveBubble(index, -1)} disabled={index === 0} aria-label="Move bubble earlier">↑</button>
                            <button type="button" onClick={() => onMoveBubble(index, 1)} disabled={index === selectedPanel.bubbles.length - 1} aria-label="Move bubble later">↓</button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
